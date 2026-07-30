import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bindCitationLabelToEvidenceIdentity } from "../api/v1/evidenceIdentity.js";
import type { ProcedureWorkflowCompiler } from "../api/v1/types.js";
import type { ProcedureCitation, ProcedureWorkflow } from "../procedure/index.js";
import type { ScopedSearchResult } from "../search.js";
import {
  assertClaimPackApiError,
  claimPackRequest,
  postClaimPack,
  startClaimPackHarness,
  stopClaimPackHarness,
} from "./helpers/claim-pack-v1-harness.js";
import {
  postProcedureQuery,
  procedureQueryRequest,
  procedureQueryValidators,
  startProcedureQueryHarness,
  stopProcedureQueryHarness,
  testInternalWorkflow,
} from "./helpers/procedure-query-v1-harness.js";

const DOCUMENT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const DOCUMENT_B = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const VERSION_1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const VERSION_2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";
const SECTION_1 = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";
const SECTION_2 = "cccccccc-cccc-4ccc-8ccc-ccccccccccc2";
const RAW_LABEL = "Manual municipal, artículo 12";
const VERSION_1_TEXT =
  "La unidad municipal recibe la solicitud y la remite a planificación para revisión documental.";
const VERSION_2_TEXT =
  "La unidad municipal rechaza la solicitud cuando no incluye la certificación indicada.";
const SOURCE_URL_1 = "https://muniantigua.gob.gt/manual-procedimientos-v1.pdf";
const SOURCE_URL_2 = "https://muniantigua.gob.gt/manual-procedimientos-v2.pdf";

const citation = (
  documentId: string,
  versionId: string,
  sectionId: string,
  excerpt: string,
  sourceUrl: string
): ProcedureCitation => ({
  citationLabel: bindCitationLabelToEvidenceIdentity(RAW_LABEL, {
    documentId,
    documentVersionId: versionId,
    sectionId,
  }),
  sourceType: "manual",
  pageStart: 12,
  excerpt,
  sourceUrl,
  authorityClass: "municipal_official",
  authorityLabel: "Municipalidad de La Antigua Guatemala",
  authorityLevel: "primary",
  evidenceUse: "cited_text",
});

const record = (
  documentId: string,
  versionId: string,
  sectionId: string,
  snippet: string,
  sourceUrl: string,
  hashCharacter: string
): ScopedSearchResult => ({
  documentTitle: "Manual municipal de procedimientos",
  documentType: "manual",
  citationLabel: RAW_LABEL,
  pageStart: 12,
  keywordScore: 0.96,
  snippet,
  sourceUrl,
  documentId,
  documentVersionId: versionId,
  sectionId,
  contentSha256: hashCharacter.repeat(64),
  officialSource: true,
  documentScope: "municipal",
  documentStatus: "active",
  versionExtractionStatus: "processed",
  documentMetadata: { confidentiality: "public" },
  municipalityName: "Municipalidad de La Antigua Guatemala",
  municipalitySlug: "la-antigua-guatemala-sacatepequez",
});

interface ConflictFixtureOptions {
  sameExcerpt?: boolean;
  sameVersion?: boolean;
  differentDocument?: boolean;
}

const conflictFixture = (
  options: ConflictFixtureOptions = {}
): { workflow: ProcedureWorkflow; records: ScopedSearchResult[] } => {
  const secondDocumentId = options.differentDocument ? DOCUMENT_B : DOCUMENT_A;
  const secondVersionId = options.sameVersion ? VERSION_1 : VERSION_2;
  const secondText = options.sameExcerpt ? VERSION_1_TEXT : VERSION_2_TEXT;
  const firstCitation = citation(
    DOCUMENT_A,
    VERSION_1,
    SECTION_1,
    VERSION_1_TEXT,
    SOURCE_URL_1
  );
  const secondCitation = citation(
    secondDocumentId,
    secondVersionId,
    SECTION_2,
    secondText,
    SOURCE_URL_2
  );
  const base = testInternalWorkflow();
  const workflow: ProcedureWorkflow = {
    ...base,
    title: "Recepción de solicitud comunitaria con versiones documentales",
    summary: "Dos versiones documentales deben compararse antes de ejecutar el paso.",
    confidence: "medium",
    steps: [
      {
        ...base.steps[0]!,
        title: "Recibir y verificar la solicitud",
        action: "Determinar el tratamiento documental aplicable a la solicitud comunitaria.",
        legalBasis: [firstCitation, secondCitation],
        sourceEvidence: [firstCitation, secondCitation],
        evidenceStatus: "supported",
        confidence: "medium",
      },
    ],
    gaps: [],
    citations: [firstCitation, secondCitation],
    validationWarning:
      "Comparar la vigencia y supersession de las versiones antes de ejecutar el procedimiento.",
    metadata: {
      ...base.metadata,
      evidenceCount: 2,
      hasLocalEvidence: true,
      hasAntiguaEvidence: true,
      hasExternalReference: false,
    },
  };
  return {
    workflow,
    records: [
      record(DOCUMENT_A, VERSION_1, SECTION_1, VERSION_1_TEXT, SOURCE_URL_1, "1"),
      record(secondDocumentId, secondVersionId, SECTION_2, secondText, SOURCE_URL_2, "2"),
    ],
  };
};

const compilerFor = (
  fixture: { workflow: ProcedureWorkflow; records: ScopedSearchResult[] },
  calls: { count: number }
): ProcedureWorkflowCompiler =>
  async () => {
    calls.count += 1;
    return { workflow: fixture.workflow, evidenceRecords: fixture.records };
  };

describe("EVAL-CONFLICT-001", () => {
  it("shows different text from two versions and requires review without silent promotion", async () => {
    const calls = { count: 0 };
    const harness = await startProcedureQueryHarness({
      compiler: compilerFor(conflictFixture(), calls),
    });
    try {
      const result = await postProcedureQuery(
        harness,
        procedureQueryRequest({ requested_output: "evidence_bundle" }),
        { idempotencyKey: "eval-conflict-bundle-000001" }
      );
      const validators = await procedureQueryValidators;
      assert.equal(result.response.status, 200);
      assert.equal(
        validators.evidenceBundle(result.json),
        true,
        JSON.stringify(validators.evidenceBundle.errors)
      );

      const claims = result.json.claims as Array<Record<string, unknown>>;
      const citations = result.json.citations as Array<Record<string, unknown>>;
      const contradictions = result.json.contradictions as Array<Record<string, unknown>>;
      assert.equal(claims.length, 2);
      assert.equal(citations.length, 2);
      assert.equal(contradictions.length, 1);
      assert.deepEqual(
        new Set(claims.map((claim) => claim.evidence_status)),
        new Set(["inferred_for_review"])
      );
      for (const claim of claims) {
        assert.equal((claim.citation_refs as string[]).length, 1);
        assert.ok((claim.limitations as string[]).some((item) => /conflicto explícito/i.test(item)));
      }
      const contradiction = contradictions[0]!;
      assert.equal(contradiction.review_required, true);
      assert.deepEqual(
        new Set(contradiction.claim_refs as string[]),
        new Set(claims.map((claim) => claim.claim_id as string))
      );
      assert.match(String(contradiction.description), /versiones con texto diferente/i);
      assert.match(String(contradiction.description), /no una conclusión semántica automática/i);
      assert.equal(
        (result.json.missing_evidence as Array<Record<string, unknown>>).some(
          (gap) => /Resolución humana del conflicto de versiones/.test(String(gap.missing_document))
        ),
        true
      );
      assert.equal(
        (result.json.limitations as string[]).some((item) => /ninguna versión puede promoverse silenciosamente/i.test(item)),
        true
      );
      assert.equal(calls.count, 1);
    } finally {
      await stopProcedureQueryHarness(harness);
    }
  });

  it("downgrades the workflow step, keeps the draft lifecycle, and adds a blocking gap", async () => {
    const calls = { count: 0 };
    const harness = await startProcedureQueryHarness({
      compiler: compilerFor(conflictFixture(), calls),
    });
    try {
      const result = await postProcedureQuery(
        harness,
        procedureQueryRequest({ requested_output: "procedure_workflow" }),
        { idempotencyKey: "eval-conflict-workflow-000001" }
      );
      const validators = await procedureQueryValidators;
      assert.equal(result.response.status, 200);
      assert.equal(
        validators.workflow(result.json),
        true,
        JSON.stringify(validators.workflow.errors)
      );
      assert.equal(result.json.approval_status, "draft");
      const step = (result.json.steps as Array<Record<string, unknown>>)[0]!;
      assert.equal(step.evidence_status, "inferred_for_review");
      assert.equal(step.confidence, 0.4);
      assert.ok((step.risks as string[]).some((item) => /Promover silenciosamente/.test(item)));
      assert.ok((step.unknowns as string[]).some((item) => /Versión documental aplicable/.test(item)));
      assert.ok(
        (result.json.gaps as Array<Record<string, unknown>>).some(
          (gap) =>
            gap.severity === "blocking" &&
            /Conflicto de versiones documentales/.test(String(gap.description))
        )
      );
      assert.equal(
        (result.json.limitations as string[]).some((item) => /ninguna versión puede promoverse silenciosamente/i.test(item)),
        true
      );
      assert.equal(calls.count, 1);
    } finally {
      await stopProcedureQueryHarness(harness);
    }
  });

  it("refuses to emit a ClaimPack while the version conflict remains unresolved", async () => {
    const calls = { count: 0 };
    const harness = await startClaimPackHarness({
      compiler: compilerFor(conflictFixture(), calls),
    });
    try {
      const result = await postClaimPack(harness, claimPackRequest(), {
        idempotencyKey: "eval-conflict-claim-pack-000001",
      });
      await assertClaimPackApiError(result, 409, "insufficient_evidence");
      assert.equal("claims" in result.json, false);
      assert.equal(calls.count, 1);
      assert.equal(
        harness.persistence.audits.some(
          (audit) =>
            audit.eventType === "integration.claim_pack.rejected" &&
            audit.reasonCode === "insufficient_citable_evidence"
        ),
        true
      );
    } finally {
      await stopClaimPackHarness(harness);
    }
  });

  it("blocks ClaimPack even when another non-conflicting supported step exists", async () => {
    const fixture = conflictFixture();
    const independentCitation = citation(
      DOCUMENT_B,
      "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
      "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
      "La unidad registra la fecha de recepción de la solicitud.",
      "https://muniantigua.gob.gt/manual-registro.pdf"
    );
    independentCitation.citationLabel = bindCitationLabelToEvidenceIdentity(
      "Manual de registro, artículo 3",
      {
        documentId: DOCUMENT_B,
        documentVersionId: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
        sectionId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
      }
    );
    fixture.workflow.steps.push({
      ...fixture.workflow.steps[0]!,
      stepNumber: 2,
      title: "Registrar fecha de recepción",
      action: "Registrar documentalmente la fecha de recepción.",
      legalBasis: [independentCitation],
      sourceEvidence: [independentCitation],
    });
    fixture.workflow.citations.push(independentCitation);
    fixture.records.push({
      ...record(
        DOCUMENT_B,
        "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
        "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
        "La unidad registra la fecha de recepción de la solicitud.",
        "https://muniantigua.gob.gt/manual-registro.pdf",
        "3"
      ),
      citationLabel: "Manual de registro, artículo 3",
    });

    const calls = { count: 0 };
    const harness = await startClaimPackHarness({ compiler: compilerFor(fixture, calls) });
    try {
      const result = await postClaimPack(harness, claimPackRequest(), {
        idempotencyKey: "eval-conflict-mixed-claim-pack-000001",
      });
      await assertClaimPackApiError(result, 409, "insufficient_evidence");
      assert.equal(calls.count, 1);
    } finally {
      await stopClaimPackHarness(harness);
    }
  });

  it("does not create a conflict when versions contain the same cited text", async () => {
    const calls = { count: 0 };
    const harness = await startProcedureQueryHarness({
      compiler: compilerFor(conflictFixture({ sameExcerpt: true }), calls),
    });
    try {
      const result = await postProcedureQuery(
        harness,
        procedureQueryRequest({ requested_output: "evidence_bundle" }),
        { idempotencyKey: "eval-conflict-identical-text-000001" }
      );
      const validators = await procedureQueryValidators;
      assert.equal(result.response.status, 200);
      assert.equal(validators.evidenceBundle(result.json), true);
      assert.deepEqual(result.json.contradictions, []);
      const claims = result.json.claims as Array<Record<string, unknown>>;
      assert.equal(claims.length, 1);
      assert.equal(claims[0]?.evidence_status, "supported");
      assert.equal((claims[0]?.citation_refs as string[]).length, 2);
      assert.equal(calls.count, 1);
    } finally {
      await stopProcedureQueryHarness(harness);
    }
  });

  it("ignores retrieval highlight markup when comparing version text", async () => {
    const fixture = conflictFixture({ sameExcerpt: true });
    fixture.records[1] = {
      ...fixture.records[1]!,
      snippet: VERSION_1_TEXT.replace("solicitud", "<mark>solicitud</mark>"),
    };
    const calls = { count: 0 };
    const harness = await startProcedureQueryHarness({ compiler: compilerFor(fixture, calls) });
    try {
      const result = await postProcedureQuery(
        harness,
        procedureQueryRequest({ requested_output: "evidence_bundle" }),
        { idempotencyKey: "eval-conflict-highlight-markup-000001" }
      );
      const validators = await procedureQueryValidators;
      assert.equal(result.response.status, 200);
      assert.equal(validators.evidenceBundle(result.json), true);
      assert.deepEqual(result.json.contradictions, []);
      assert.equal((result.json.claims as Array<Record<string, unknown>>)[0]?.evidence_status, "supported");
      assert.equal(calls.count, 1);
    } finally {
      await stopProcedureQueryHarness(harness);
    }
  });

  it("does not treat different excerpts from the same version as a version conflict", async () => {
    const calls = { count: 0 };
    const harness = await startProcedureQueryHarness({
      compiler: compilerFor(conflictFixture({ sameVersion: true }), calls),
    });
    try {
      const result = await postProcedureQuery(
        harness,
        procedureQueryRequest({ requested_output: "evidence_bundle" }),
        { idempotencyKey: "eval-conflict-same-version-000001" }
      );
      const validators = await procedureQueryValidators;
      assert.equal(result.response.status, 200);
      assert.equal(validators.evidenceBundle(result.json), true);
      assert.deepEqual(result.json.contradictions, []);
      const claims = result.json.claims as Array<Record<string, unknown>>;
      assert.equal(claims.length, 1);
      assert.equal(claims[0]?.evidence_status, "supported");
      assert.equal(calls.count, 1);
    } finally {
      await stopProcedureQueryHarness(harness);
    }
  });

  it("does not join different documents into a false version conflict", async () => {
    const calls = { count: 0 };
    const harness = await startProcedureQueryHarness({
      compiler: compilerFor(conflictFixture({ differentDocument: true }), calls),
    });
    try {
      const result = await postProcedureQuery(
        harness,
        procedureQueryRequest({ requested_output: "evidence_bundle" }),
        { idempotencyKey: "eval-conflict-different-documents-000001" }
      );
      const validators = await procedureQueryValidators;
      assert.equal(result.response.status, 200);
      assert.equal(validators.evidenceBundle(result.json), true);
      assert.deepEqual(result.json.contradictions, []);
      const claims = result.json.claims as Array<Record<string, unknown>>;
      assert.equal(claims.length, 1);
      assert.equal(claims[0]?.evidence_status, "supported");
      assert.equal(calls.count, 1);
    } finally {
      await stopProcedureQueryHarness(harness);
    }
  });
});
