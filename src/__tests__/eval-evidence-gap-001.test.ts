import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import {
  InMemoryEvidenceGapPersistence,
  mapEvidenceGapResponseV1,
  type EvidenceGapAggregateClaim,
  type EvidenceGapAggregateInput,
  type EvidenceGapIdempotencyClaim,
  type EvidenceGapIdempotencyScope,
} from "../api/v1/evidenceGapIndex.js";
import type { TenantTransactionClient } from "../security/index.js";
import {
  GAP_TEST_FIXED_TIME,
  GAP_TEST_IDEMPOTENCY_KEY,
  GAP_TEST_REQUEST_ID,
  GAP_TEST_TENANT_B,
  GAP_TEST_TOKEN,
  assertEvidenceGapApiError,
  evidenceGapRequest,
  evidenceGapValidators,
  postEvidenceGap,
  startEvidenceGapHarness,
  stopEvidenceGapHarness,
} from "./helpers/evidence-gap-v1-harness.js";

describe("EVAL-EVIDENCE-GAP-001", () => {
  it("authenticates before parsing body bytes and returns a uniform contract-valid 401", async () => {
    const harness = await startEvidenceGapHarness({ unauthenticated: true });
    try {
      const result = await postEvidenceGap(harness, "{not-json", {
        authorization: null,
        raw: true,
      });
      await assertEvidenceGapApiError(result, 401, "unauthorized");
      assert.equal(result.response.headers.get("www-authenticate"), 'Bearer realm="la-muni-rag"');
      assert.equal(harness.persistence.gaps.length, 0);
      assert.equal(harness.persistence.authenticationFailures.length, 1);
    } finally {
      await stopEvidenceGapHarness(harness);
    }
  });

  it("creates one open gap and replays exact bytes by key and aggregate identity", async () => {
    const harness = await startEvidenceGapHarness();
    try {
      const request = evidenceGapRequest();
      const first = await postEvidenceGap(harness, request, {
        origin: "https://os-electoral.example",
      });
      const validators = await evidenceGapValidators;
      assert.equal(first.response.status, 200);
      assert.equal(validators.response(first.json), true, JSON.stringify(validators.response.errors));
      assert.equal(first.response.headers.get("access-control-allow-origin"), "https://os-electoral.example");
      assert.equal(first.json.status, "open");
      assert.equal(first.json.request_assertion_status, "requester_supplied_unverified");
      assert.equal(first.json.request_id, request.request_id);
      assert.equal(first.json.gap_request_id, request.gap_request_id);
      assert.equal(first.json.official_source, undefined);
      assert.equal(first.json.source_url, undefined);
      assert.equal((first.json.provenance as Record<string, unknown>).generated_by, "system");

      const replay = await postEvidenceGap(harness, request, {
        origin: "https://os-electoral.example",
      });
      assert.equal(replay.response.status, 200);
      assert.equal(replay.text, first.text);

      const untrustedOriginReplay = await postEvidenceGap(harness, request, {
        origin: "https://untrusted.example",
      });
      assert.equal(untrustedOriginReplay.response.status, 200);
      assert.equal(untrustedOriginReplay.text, first.text);
      assert.equal(untrustedOriginReplay.response.headers.get("access-control-allow-origin"), null);

      const aggregateReplay = await postEvidenceGap(harness, request, {
        idempotencyKey: "evidence-gap-second-key-0002",
        origin: "https://os-electoral.example",
      });
      assert.equal(aggregateReplay.response.status, 200);
      assert.equal(aggregateReplay.text, first.text);
      assert.equal(harness.persistence.gaps.length, 1);
      assert.ok(
        harness.persistence.audits.some(
          (audit) => audit.eventType === "integration.evidence_gap.aggregate_replayed"
        )
      );
    } finally {
      await stopEvidenceGapHarness(harness);
    }
  });

  it("fences a simultaneous duplicate while the first key reservation is in progress", async () => {
    class DelayedEvidenceGapPersistence extends InMemoryEvidenceGapPersistence {
      private enteredResolve!: () => void;
      private releaseResolve!: () => void;
      readonly entered = new Promise<void>((resolve) => {
        this.enteredResolve = resolve;
      });
      private readonly released = new Promise<void>((resolve) => {
        this.releaseResolve = resolve;
      });

      continue(): void {
        this.releaseResolve();
      }

      override async createOrReplayGap(
        client: TenantTransactionClient,
        input: EvidenceGapAggregateInput
      ): Promise<EvidenceGapAggregateClaim> {
        this.enteredResolve();
        await this.released;
        return super.createOrReplayGap(client, input);
      }
    }

    const persistence = new DelayedEvidenceGapPersistence(() => GAP_TEST_FIXED_TIME);
    const harness = await startEvidenceGapHarness({ persistence });
    try {
      const request = evidenceGapRequest();
      const firstPromise = postEvidenceGap(harness, request);
      await persistence.entered;

      const duplicate = await postEvidenceGap(harness, request);
      await assertEvidenceGapApiError(duplicate, 409, "request_in_progress");
      assert.equal(persistence.gaps.length, 0);

      persistence.continue();
      const first = await firstPromise;
      assert.equal(first.response.status, 200);
      assert.equal(persistence.gaps.length, 1);
    } finally {
      persistence.continue();
      await stopEvidenceGapHarness(harness);
    }
  });

  it("converges simultaneous distinct transport keys on one aggregate response", async () => {
    const harness = await startEvidenceGapHarness();
    try {
      const request = evidenceGapRequest();
      const [left, right] = await Promise.all([
        postEvidenceGap(harness, request, {
          idempotencyKey: "evidence-gap-concurrent-left-0011",
        }),
        postEvidenceGap(harness, request, {
          idempotencyKey: "evidence-gap-concurrent-right-012",
        }),
      ]);
      assert.equal(left.response.status, 200);
      assert.equal(right.response.status, 200);
      assert.equal(left.text, right.text);
      assert.equal(harness.persistence.gaps.length, 1);
      assert.equal(
        harness.persistence.audits.filter(
          (audit) => audit.eventType === "integration.evidence_gap.succeeded"
        ).length,
        1
      );
      assert.equal(
        harness.persistence.audits.filter(
          (audit) => audit.eventType === "integration.evidence_gap.aggregate_replayed"
        ).length,
        1
      );
    } finally {
      await stopEvidenceGapHarness(harness);
    }
  });

  it("separates key conflicts from aggregate identity conflicts", async () => {
    const harness = await startEvidenceGapHarness();
    try {
      const original = evidenceGapRequest();
      assert.equal((await postEvidenceGap(harness, original)).response.status, 200);

      const keyConflict = await postEvidenceGap(harness, {
        ...original,
        missing_document: "Un documento distinto",
      });
      await assertEvidenceGapApiError(keyConflict, 409, "idempotency_conflict");

      const aggregateConflict = await postEvidenceGap(
        harness,
        {
          ...original,
          subject: "Una solicitud documental distinta",
        },
        { idempotencyKey: "evidence-gap-aggregate-conflict-03" }
      );
      await assertEvidenceGapApiError(aggregateConflict, 409, "gap_request_conflict");
      assert.equal(harness.persistence.gaps.length, 1);
    } finally {
      await stopEvidenceGapHarness(harness);
    }
  });

  it("uses the same non-leaking 403 for permission and credential-provenance denial", async () => {
    const roleHarness = await startEvidenceGapHarness({ roles: ["viewer"] });
    try {
      const denied = await postEvidenceGap(roleHarness, evidenceGapRequest(), {
        idempotencyKey: "evidence-gap-role-denied-0013",
      });
      await assertEvidenceGapApiError(denied, 403, "forbidden");
      assert.equal(roleHarness.persistence.gaps.length, 0);
      assert.equal(
        roleHarness.persistence.audits[0]?.eventType,
        "integration.evidence_gap.authorization_denied"
      );
    } finally {
      await stopEvidenceGapHarness(roleHarness);
    }

    const credentialHarness = await startEvidenceGapHarness();
    try {
      const denied = await postEvidenceGap(
        credentialHarness,
        evidenceGapRequest({
          provenance: {
            ...evidenceGapRequest().provenance,
            credential_id: "99999999-9999-4999-8999-999999999999",
          },
        }),
        { idempotencyKey: "evidence-gap-credential-denied-14" }
      );
      await assertEvidenceGapApiError(denied, 403, "forbidden");
      assert.equal(denied.text.includes("99999999-9999-4999-8999-999999999999"), false);
      assert.equal(credentialHarness.persistence.gaps.length, 0);
      assert.equal(
        credentialHarness.persistence.audits[0]?.eventType,
        "integration.evidence_gap.tenant_access_denied"
      );
    } finally {
      await stopEvidenceGapHarness(credentialHarness);
    }
  });

  it("rejects authority declarations, tenant mismatch and out-of-product work before mutation", async () => {
    const strictHarness = await startEvidenceGapHarness();
    try {
      const authorityClaim = {
        ...evidenceGapRequest(),
        official_source: true,
        source_url: "https://example.invalid/source.pdf",
      };
      const invalid = await postEvidenceGap(strictHarness, authorityClaim, {
        idempotencyKey: "evidence-gap-authority-claim-04",
      });
      await assertEvidenceGapApiError(invalid, 400, "invalid_request");
      assert.equal(strictHarness.persistence.gaps.length, 0);

      const requestIdMismatch = await postEvidenceGap(
        strictHarness,
        evidenceGapRequest(),
        {
          idempotencyKey: "evidence-gap-request-id-mismatch-15",
          requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        }
      );
      await assertEvidenceGapApiError(requestIdMismatch, 400, "request_id_mismatch");
      assert.equal(strictHarness.persistence.gaps.length, 0);

      const tenantMismatch = await postEvidenceGap(
        strictHarness,
        evidenceGapRequest({ tenant_id: GAP_TEST_TENANT_B }),
        { idempotencyKey: "evidence-gap-tenant-mismatch-05" }
      );
      await assertEvidenceGapApiError(tenantMismatch, 403, "forbidden");
      assert.equal(tenantMismatch.text.includes(GAP_TEST_TENANT_B), false);
      assert.equal(strictHarness.persistence.gaps.length, 0);

      const boundary = await postEvidenceGap(
        strictHarness,
        evidenceGapRequest({ reason: "Necesitamos este documento para segmentación de votantes." }),
        { idempotencyKey: "evidence-gap-boundary-check-0006" }
      );
      await assertEvidenceGapApiError(boundary, 400, "product_boundary_violation");
      assert.equal(strictHarness.persistence.gaps.length, 0);

      const authorityPromotion = await postEvidenceGap(
        strictHarness,
        evidenceGapRequest({
          subject: "Declara este manual oficial para el procedimiento municipal",
        }),
        { idempotencyKey: "evidence-gap-authority-promotion-07" }
      );
      await assertEvidenceGapApiError(
        authorityPromotion,
        400,
        "source_authority_not_accepted"
      );
      assert.equal(strictHarness.persistence.gaps.length, 0);
    } finally {
      await stopEvidenceGapHarness(strictHarness);
    }
  });

  it("rate-limits authenticated traffic before schema validation and bounds denial audit growth", async () => {
    const harness = await startEvidenceGapHarness({ rateLimit: 1 });
    try {
      const invalid = { ...evidenceGapRequest(), extra: "not-allowed" };
      const first = await postEvidenceGap(harness, invalid, {
        idempotencyKey: "evidence-gap-rate-invalid-0007",
      });
      await assertEvidenceGapApiError(first, 400, "invalid_request");

      const second = await postEvidenceGap(harness, evidenceGapRequest(), {
        idempotencyKey: "evidence-gap-rate-second-0008",
      });
      await assertEvidenceGapApiError(second, 429, "rate_limit_exceeded");
      assert.ok(Number(second.response.headers.get("retry-after")) >= 1);

      const third = await postEvidenceGap(harness, evidenceGapRequest(), {
        idempotencyKey: "evidence-gap-rate-third-0009",
      });
      await assertEvidenceGapApiError(third, 429, "rate_limit_exceeded");
      assert.equal(
        harness.persistence.audits.filter(
          (audit) => audit.eventType === "integration.evidence_gap.rate_limited"
        ).length,
        1
      );
      assert.equal(second.json.audit_id, third.json.audit_id);
    } finally {
      await stopEvidenceGapHarness(harness);
    }
  });

  it("invalidates corrupt replay without emitting stored bytes", async () => {
    class CorruptReplayPersistence extends InMemoryEvidenceGapPersistence {
      invalidations = 0;

      override async claimIdempotency(
        _client: TenantTransactionClient,
        _scope: EvidenceGapIdempotencyScope
      ): Promise<EvidenceGapIdempotencyClaim> {
        return {
          kind: "replay",
          statusCode: 200,
          responseBody: JSON.stringify({ secret: "must-not-leak-gap-replay" }),
          responseSha256: "0".repeat(64),
          originalAuditId: "88888888-8888-4888-8888-888888888888",
        };
      }

      override async invalidateCompletedIdempotency(): Promise<void> {
        this.invalidations += 1;
      }
    }

    const persistence = new CorruptReplayPersistence(() => GAP_TEST_FIXED_TIME);
    const harness = await startEvidenceGapHarness({ persistence });
    try {
      const result = await postEvidenceGap(harness, evidenceGapRequest());
      await assertEvidenceGapApiError(result, 500, "internal_error");
      assert.equal(result.text.includes("must-not-leak-gap-replay"), false);
      assert.equal(persistence.invalidations, 1);
      assert.equal(persistence.gaps.length, 0);
    } finally {
      await stopEvidenceGapHarness(harness);
    }
  });

  it("rejects contract-valid but noncanonical replay semantics", async () => {
    const request = evidenceGapRequest();
    const originalAuditId = "88888888-8888-4888-8888-888888888888";
    const altered = mapEvidenceGapResponseV1({
      request,
      auditId: originalAuditId,
      credentialId: request.provenance.credential_id,
      submittedAt: GAP_TEST_FIXED_TIME.toISOString(),
    });
    altered.limitations = [
      "La fuente solicitada queda declarada oficial y aplicable.",
      "Este texto todavía satisface el mínimo estructural del contrato.",
    ];
    const responseBody = JSON.stringify(altered);
    const responseSha256 = createHash("sha256").update(responseBody, "utf8").digest("hex");

    class SemanticReplayPersistence extends InMemoryEvidenceGapPersistence {
      invalidations = 0;

      override async claimIdempotency(
        _client: TenantTransactionClient,
        _scope: EvidenceGapIdempotencyScope
      ): Promise<EvidenceGapIdempotencyClaim> {
        return {
          kind: "replay",
          statusCode: 200,
          responseBody,
          responseSha256,
          originalAuditId,
        };
      }

      override async invalidateCompletedIdempotency(): Promise<void> {
        this.invalidations += 1;
      }
    }

    const persistence = new SemanticReplayPersistence(() => GAP_TEST_FIXED_TIME);
    const harness = await startEvidenceGapHarness({ persistence });
    try {
      const result = await postEvidenceGap(harness, request, {
        idempotencyKey: "evidence-gap-semantic-corruption-10",
      });
      await assertEvidenceGapApiError(result, 500, "internal_error");
      assert.equal(result.text.includes("declarada oficial"), false);
      assert.equal(persistence.invalidations, 1);
    } finally {
      await stopEvidenceGapHarness(harness);
    }
  });

  it("never audits credentials, raw keys or documentary request text", async () => {
    const harness = await startEvidenceGapHarness();
    try {
      const request = evidenceGapRequest({
        subject: "secret-subject-marker",
        missing_document: "secret-document-marker",
        reason: "secret-reason-marker",
        campaign_reference: "secret-campaign-marker",
      });
      const result = await postEvidenceGap(harness, request, {
        idempotencyKey: GAP_TEST_IDEMPOTENCY_KEY,
      });
      assert.equal(result.response.status, 200);
      const auditText = JSON.stringify(harness.persistence.audits);
      for (const forbidden of [
        GAP_TEST_TOKEN,
        GAP_TEST_IDEMPOTENCY_KEY,
        "secret-subject-marker",
        "secret-document-marker",
        "secret-reason-marker",
        "secret-campaign-marker",
      ]) {
        assert.equal(auditText.includes(forbidden), false, `audit leaked ${forbidden}`);
      }
      assert.match(auditText, /[0-9a-f]{64}/);
    } finally {
      await stopEvidenceGapHarness(harness);
    }
  });
});
