import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bindCitationLabelToEvidenceIdentity } from "../api/v1/evidenceIdentity.js";
import { MIXCO_COMPARATIVE_WARNING } from "../api/v1/mapper.js";
import type { ProcedureWorkflowCompiler } from "../api/v1/types.js";
import type { ProcedureCitation, ProcedureWorkflow } from "../procedure/index.js";
import type { ScopedSearchResult } from "../search.js";
import {
  assertClaimPackApiError,
  CLAIM_TEST_CREDENTIAL_ID,
  CLAIM_TEST_FIXED_TIME,
  CLAIM_TEST_IDEMPOTENCY_KEY,
  CLAIM_TEST_TENANT_B,
  CLAIM_TEST_VALID_UNTIL,
  claimPackRequest,
  claimPackValidators,
  postClaimPack,
  startClaimPackHarness,
  stopClaimPackHarness,
} from "./helpers/claim-pack-v1-harness.js";
import { testInternalWorkflow } from "./helpers/procedure-query-v1-harness.js";

const CONTENT_ORIGIN = "https://content-agency.example";
const DOCUMENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const VERSION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";
const SECTION_ID = "cccccccc-cccc-4ccc-8ccc-ccccccccccc2";
const RAW_LABEL = "Manual municipal, sección 18";
const ANTIGUA_SOURCE_URL = "https://muniantigua.gob.gt/manual-solicitudes.pdf";
const MIXCO_SOURCE_URL = "https://munimixco.gob.gt/manual-solicitudes.pdf";
const EXCERPT =
  "La unidad municipal recibe la solicitud comunitaria y verifica documentalmente el expediente.";

const citation = (
  authority: "municipal_official" | "external_reference" = "municipal_official",
  evidenceUse: ProcedureCitation["evidenceUse"] = "cited_text"
): ProcedureCitation => ({
  citationLabel: bindCitationLabelToEvidenceIdentity(RAW_LABEL, {
    documentId: DOCUMENT_ID,
    documentVersionId: VERSION_ID,
    sectionId: SECTION_ID,
  }),
  sourceType: "manual",
  pageStart: 18,
  excerpt: EXCERPT,
  sourceUrl: authority === "municipal_official" ? ANTIGUA_SOURCE_URL : MIXCO_SOURCE_URL,
  authorityClass: authority,
  authorityLabel:
    authority === "municipal_official"
      ? "Municipalidad de La Antigua Guatemala"
      : "Municipalidad de Mixco",
  evidenceUse,
});

const workflow = (
  authority: "municipal_official" | "external_reference" = "municipal_official",
  evidenceUse: ProcedureCitation["evidenceUse"] = "cited_text"
): ProcedureWorkflow => {
  const base = testInternalWorkflow();
  const sourceCitation = citation(authority, evidenceUse);
  const supported = evidenceUse === "cited_text";
  return {
    ...base,
    title: "Recepción documental de una solicitud comunitaria",
    summary: "La fuente se evalúa para una afirmación documental inicial.",
    confidence: supported && authority === "municipal_official" ? "medium" : "low",
    jurisdiction:
      authority === "municipal_official" ? "Antigua Guatemala" : "external reference",
    steps: [
      {
        ...base.steps[0]!,
        title: "Recibir y verificar la solicitud",
        action:
          "Recibir la solicitud comunitaria y verificar documentalmente el expediente antes de continuar.",
        legalBasis: [sourceCitation],
        sourceEvidence: [sourceCitation],
        evidenceStatus: supported ? "supported" : evidenceUse === "inference" ? "inferred" : "insufficient",
        confidence: supported && authority === "municipal_official" ? "medium" : "low",
        sourceAttribution: {
          status: authority === "municipal_official" ? "official_municipal" : "comparative",
          heading:
            authority === "municipal_official"
              ? "Fuente municipal oficial"
              : "Referencia comparativa",
          statement:
            authority === "municipal_official"
              ? "La evidencia corresponde a Antigua Guatemala."
              : MIXCO_COMPARATIVE_WARNING,
          primaryCitation: sourceCitation,
          citations: [sourceCitation],
        },
      },
    ],
    gaps: [],
    citations: [sourceCitation],
    validationWarning:
      authority === "municipal_official"
        ? "Validar vigencia y aplicación al caso concreto."
        : MIXCO_COMPARATIVE_WARNING,
    metadata: {
      ...base.metadata,
      evidenceCount: 1,
      hasLocalEvidence: authority === "municipal_official",
      hasAntiguaEvidence: authority === "municipal_official",
      hasExternalReference: authority === "external_reference",
    },
  };
};

const record = (municipality: "antigua" | "mixco" = "antigua"): ScopedSearchResult => ({
  documentTitle:
    municipality === "antigua"
      ? "Manual de procedimientos de la Municipalidad de La Antigua Guatemala"
      : "Manual de procedimientos de la Municipalidad de Mixco",
  documentType: "manual",
  citationLabel: RAW_LABEL,
  pageStart: 18,
  keywordScore: 0.94,
  snippet: EXCERPT,
  sourceUrl: municipality === "antigua" ? ANTIGUA_SOURCE_URL : MIXCO_SOURCE_URL,
  documentId: DOCUMENT_ID,
  documentVersionId: VERSION_ID,
  sectionId: SECTION_ID,
  contentSha256: "e".repeat(64),
  officialSource: true,
  documentScope: "municipal",
  documentStatus: "active",
  versionExtractionStatus: "processed",
  documentMetadata: { confidentiality: "public" },
  municipalityName:
    municipality === "antigua"
      ? "Municipalidad de La Antigua Guatemala"
      : "Municipalidad de Mixco",
  municipalitySlug:
    municipality === "antigua" ? "la-antigua-guatemala-sacatepequez" : "mixco",
});

const compiler = (
  calls: { count: number },
  municipality: "antigua" | "mixco" = "antigua",
  evidenceUse: ProcedureCitation["evidenceUse"] = "cited_text"
): ProcedureWorkflowCompiler =>
  async () => {
    calls.count += 1;
    return {
      workflow: workflow(
        municipality === "antigua" ? "municipal_official" : "external_reference",
        evidenceUse
      ),
      evidenceRecords: [record(municipality)],
    };
  };

const forbiddenFields = [
  "copy",
  "artifacts",
  "content_calendar",
  "channels",
  "publication_tasks",
  "campaign_strategy",
  "electoral_segments",
  "approved_message",
  "campaign_id",
  "community_id",
] as const;

const assertNoContentOrCampaignFields = (value: Record<string, unknown>): void => {
  for (const field of forbiddenFields) {
    assert.equal(field in value, false, `unexpected field ${field}`);
  }
};

describe("EVAL-CONTENT-INTEGRATION-001", () => {
  it("returns an identity-bound ClaimPack and replays exact bytes", async () => {
    const calls = { count: 0 };
    const harness = await startClaimPackHarness({ compiler: compiler(calls) });
    const request = claimPackRequest();
    try {
      const first = await postClaimPack(harness, request, {
        idempotencyKey: CLAIM_TEST_IDEMPOTENCY_KEY,
        origin: CONTENT_ORIGIN,
      });
      const validators = await claimPackValidators;

      assert.equal(first.response.status, 200);
      assert.equal(validators.claimPack(first.json), true, JSON.stringify(validators.claimPack.errors));
      assert.equal(first.response.headers.get("access-control-allow-origin"), CONTENT_ORIGIN);
      assert.equal(first.response.headers.get("cache-control"), "no-store");
      assert.equal(first.json.response_type, "claim_pack");
      assert.equal(first.json.product_boundary, "claims_and_evidence_only");
      assert.equal(first.json.valid_until, CLAIM_TEST_VALID_UNTIL);
      assert.equal(
        first.json.legal_disclaimer,
        "Este paquete conserva claims y evidencia; no genera contenido ni sustituye revisión legal."
      );
      assert.deepEqual(first.json.allowed_paraphrase_scope, {
        mode: "faithful_paraphrase_only",
        allowed_operations: ["paraphrase", "summarize", "translate"],
        content_generation_allowed: false,
        campaign_strategy_allowed: false,
      });
      assert.deepEqual(first.json.source_links, [ANTIGUA_SOURCE_URL]);
      assertNoContentOrCampaignFields(first.json);

      const claims = first.json.claims as Array<Record<string, unknown>>;
      const citations = first.json.citations as Array<Record<string, unknown>>;
      assert.equal(claims.length, 1);
      assert.equal(claims[0]?.evidence_status, "supported");
      assert.equal(citations.length, 1);
      assert.equal(citations[0]?.document_version_id, VERSION_ID);
      assert.equal(citations[0]?.section_id, SECTION_ID);
      assert.deepEqual(claims[0]?.citation_refs, [citations[0]?.citation_id]);
      assert.ok(
        (first.json.limitations as string[]).some((item) => /límite operativo/.test(item))
      );
      assert.ok(
        (first.json.limitations as string[]).includes(
          "Validar vigencia y aplicación al caso concreto."
        )
      );
      assert.ok(
        (first.json.limitations as string[]).some((item) => /ausencia de contradicciones/.test(item))
      );
      assert.equal(calls.count, 1);

      const replay = await postClaimPack(harness, request, {
        idempotencyKey: CLAIM_TEST_IDEMPOTENCY_KEY,
        origin: CONTENT_ORIGIN,
      });
      assert.equal(replay.response.status, 200);
      assert.equal(replay.text, first.text);
      assert.equal(calls.count, 1);
      assert.equal(
        harness.persistence.audits.some(
          (audit) =>
            audit.eventType === "integration.claim_pack.succeeded" &&
            audit.reasonCode === "claim_pack_generated"
        ),
        true
      );
      assert.doesNotMatch(
        JSON.stringify(harness.persistence.audits),
        /claim-pack-documentary-review|Conservar citas y limitaciones/i
      );
    } finally {
      await stopClaimPackHarness(harness);
    }
  });

  it("fails closed with insufficient evidence and releases idempotency", async () => {
    const harness = await startClaimPackHarness();
    const request = claimPackRequest();
    try {
      const first = await postClaimPack(harness, request);
      await assertClaimPackApiError(first, 409, "insufficient_evidence");
      assert.equal(harness.compilerCalls.count, 1);
      assert.equal("claims" in first.json, false);
      assert.equal(
        harness.persistence.audits.some(
          (audit) =>
            audit.eventType === "integration.claim_pack.rejected" &&
            audit.reasonCode === "insufficient_citable_evidence"
        ),
        true
      );

      const second = await postClaimPack(harness, request);
      await assertClaimPackApiError(second, 409, "insufficient_evidence");
      assert.equal(harness.compilerCalls.count, 2);
    } finally {
      await stopClaimPackHarness(harness);
    }
  });

  it("invalidates an expired replay and regenerates safely with the same key", async () => {
    let currentTime = CLAIM_TEST_FIXED_TIME.getTime();
    const calls = { count: 0 };
    const harness = await startClaimPackHarness({
      compiler: compiler(calls),
      validitySeconds: 60,
      now: () => new Date(currentTime),
    });
    const request = claimPackRequest();
    const key = "claim-pack-expiry-000001";
    try {
      const first = await postClaimPack(harness, request, { idempotencyKey: key });
      assert.equal(first.response.status, 200);
      assert.equal(calls.count, 1);

      currentTime += 61_000;
      const expired = await postClaimPack(harness, request, { idempotencyKey: key });
      await assertClaimPackApiError(expired, 409, "claim_pack_expired");
      assert.equal(calls.count, 1);
      assert.equal(expired.text.includes(first.text), false);

      const regenerated = await postClaimPack(harness, request, { idempotencyKey: key });
      assert.equal(regenerated.response.status, 200);
      assert.equal(calls.count, 2);
      assert.notEqual(regenerated.text, first.text);
      assert.ok(Date.parse(String(regenerated.json.valid_until)) > currentTime);
      assert.equal(
        harness.persistence.audits.some(
          (audit) =>
            audit.eventType === "integration.claim_pack.idempotency_expired" &&
            audit.reasonCode === "stored_response_expired"
        ),
        true
      );
    } finally {
      await stopClaimPackHarness(harness);
    }
  });

  it("rejects content generation, unknown fields, unauthorized roles and unauthenticated bodies", async () => {
    const harness = await startClaimPackHarness();
    try {
      const generationRequest = claimPackRequest({
        question: "Genera copy y publicaciones para redes sociales con estas afirmaciones.",
      });
      const boundary = await postClaimPack(harness, generationRequest, {
        idempotencyKey: "claim-pack-boundary-000001",
      });
      await assertClaimPackApiError(boundary, 403, "forbidden");

      const extra = {
        ...claimPackRequest(),
        content_brief: { objective: "Create posts", channels: ["social"] },
      };
      const invalid = await postClaimPack(harness, extra, {
        idempotencyKey: "claim-pack-extra-field-000001",
      });
      await assertClaimPackApiError(invalid, 400, "invalid_request");
      assert.equal(harness.compilerCalls.count, 0);
    } finally {
      await stopClaimPackHarness(harness);
    }

    const viewer = await startClaimPackHarness({ roles: ["viewer"] });
    try {
      const denied = await postClaimPack(viewer, claimPackRequest());
      await assertClaimPackApiError(denied, 403, "forbidden");
      assert.equal(viewer.compilerCalls.count, 0);
    } finally {
      await stopClaimPackHarness(viewer);
    }

    const unauthenticated = await startClaimPackHarness({ unauthenticated: true });
    try {
      const denied = await postClaimPack(
        unauthenticated,
        '{"secret":"unterminated',
        { raw: true, authorization: null }
      );
      await assertClaimPackApiError(denied, 401, "unauthorized");
      assert.equal(denied.response.headers.get("connection"), "close");
      assert.equal(unauthenticated.compilerCalls.count, 0);
    } finally {
      await stopClaimPackHarness(unauthenticated);
    }
  });

  it("preserves Mixco as comparative and never promotes it for Antigua", async () => {
    const calls = { count: 0 };
    const harness = await startClaimPackHarness({ compiler: compiler(calls, "mixco") });
    try {
      const result = await postClaimPack(harness, claimPackRequest(), {
        idempotencyKey: "claim-pack-mixco-000001",
      });
      const validators = await claimPackValidators;
      assert.equal(result.response.status, 200);
      assert.equal(validators.claimPack(result.json), true, JSON.stringify(validators.claimPack.errors));
      const claims = result.json.claims as Array<Record<string, unknown>>;
      const citations = result.json.citations as Array<Record<string, unknown>>;
      assert.equal(claims[0]?.evidence_status, "comparative_reference");
      assert.equal(citations[0]?.authority_status, "comparative");
      assert.ok((result.json.limitations as string[]).includes(MIXCO_COMPARATIVE_WARNING));
      assert.deepEqual(result.json.source_links, [MIXCO_SOURCE_URL]);
      assertNoContentOrCampaignFields(result.json);
      assert.equal(calls.count, 1);
    } finally {
      await stopClaimPackHarness(harness);
    }
  });

  it("does not package inferred or validation-required evidence as usable claims", async () => {
    for (const evidenceUse of ["inference", "validation_required"] as const) {
      const calls = { count: 0 };
      const harness = await startClaimPackHarness({
        compiler: compiler(calls, "antigua", evidenceUse),
      });
      try {
        const result = await postClaimPack(harness, claimPackRequest(), {
          idempotencyKey: `claim-pack-${evidenceUse}-000001`,
        });
        await assertClaimPackApiError(result, 409, "insufficient_evidence");
        assert.equal(calls.count, 1);
        assert.equal("claims" in result.json, false);
      } finally {
        await stopClaimPackHarness(harness);
      }
    }
  });

  it("denies cross-tenant scope and conflicts on changed requests without metadata leakage", async () => {
    const calls = { count: 0 };
    const harness = await startClaimPackHarness({ compiler: compiler(calls) });
    try {
      const crossTenant = await postClaimPack(
        harness,
        claimPackRequest({ tenant_id: CLAIM_TEST_TENANT_B }),
        { idempotencyKey: "claim-pack-cross-tenant-000001" }
      );
      await assertClaimPackApiError(crossTenant, 403, "forbidden");
      assert.equal(crossTenant.text.includes(CLAIM_TEST_TENANT_B), false);

      const first = await postClaimPack(harness, claimPackRequest(), {
        idempotencyKey: "claim-pack-conflict-000001",
      });
      assert.equal(first.response.status, 200);
      const conflict = await postClaimPack(
        harness,
        claimPackRequest({ question: "¿Qué otra afirmación está respaldada?" }),
        { idempotencyKey: "claim-pack-conflict-000001" }
      );
      await assertClaimPackApiError(conflict, 409, "idempotency_conflict");
      assert.equal(conflict.text.includes("otra afirmación"), false);
      assert.equal(calls.count, 1);
      assert.equal(
        (first.json.provenance as Record<string, unknown>).credential_id,
        CLAIM_TEST_CREDENTIAL_ID
      );
    } finally {
      await stopClaimPackHarness(harness);
    }
  });
});
