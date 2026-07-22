import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  loadProcedureQueryContractValidators,
  mapProcedureWorkflowV1,
  type ProcedureQueryRequestV1,
} from "../api/v1/index.js";
import { municipalAntiguaDomainPack } from "../domain/packs/municipal-antigua.js";
import { WATER_PENDING_SOURCE } from "../domain/packs/municipal-antigua-water.js";
import type { EvidenceItem } from "../evidence.js";
import { classifyProcedureQuery } from "../procedure/procedureClassifier.js";
import { composeProcedureWorkflow } from "../procedure/procedureComposer.js";

const QUERY =
  "¿Qué se necesita para llevar agua potable a una comunidad de Antigua Guatemala y cómo se le da seguimiento?";

const EXPECTED_CATEGORIES = [
  "Necesidad comunitaria",
  "Solicitud",
  "COCODE",
  "COMUDE",
  "Planificación municipal",
  "Perfil",
  "Diagnóstico",
  "Fuente de agua",
  "Disponibilidad",
  "Calidad",
  "Terreno",
  "Propiedad",
  "Servidumbres",
  "Derechos de paso",
  "Topografía",
  "Estudio hidráulico",
  "Demanda",
  "PDM-OT",
  "POM",
  "POA",
  "Costo",
  "Financiamiento",
  "Inversión pública",
  "Sistema nacional aplicable",
  "Ambiente",
  "Salud",
  "Dictámenes",
  "Concejo",
  "Expediente",
  "Contratación",
  "Ofertas",
  "Adjudicación",
  "Contrato",
  "Inicio",
  "Ejecución",
  "Supervisión",
  "Bitácora",
  "Estimaciones",
  "Cambios",
  "Recepción",
  "Liquidación",
  "Pagos",
  "Operación",
  "Mantenimiento",
  "Cierre",
  "Continuidad",
  "Calidad del servicio",
] as const;

const classification = () => classifyProcedureQuery(QUERY, municipalAntiguaDomainPack);

const emptyWorkflow = () =>
  composeProcedureWorkflow(
    QUERY,
    "keyword",
    classification(),
    [],
    municipalAntiguaDomainPack,
    "deep_dive"
  );

const request: ProcedureQueryRequestV1 = {
  schema_version: "v1",
  direction: "inbound",
  product_boundary: "evidence_and_procedure_request_only",
  request_id: "11111111-1111-4111-8111-111111111111",
  tenant_id: "22222222-2222-4222-8222-222222222222",
  campaign_id: "campaign-reference-only",
  community_id: "community-antigua-water",
  question: QUERY,
  jurisdiction: "Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala",
  case_context: {
    subject_reference: "water-project-research",
    community_id: "community-antigua-water",
    facts: [],
    provided_documents: [],
    constraints: [],
  },
  requested_depth: "deep_dive",
  requested_output: "procedure_workflow",
  provenance: {
    source_product: "os_electoral",
    generated_by: "integration_client",
    created_at: "2026-07-21T12:00:00.000Z",
    source_refs: [],
    credential_id: "33333333-3333-4333-8333-333333333333",
    audit_id: "44444444-4444-4444-8444-444444444444",
  },
};

describe("EVAL-WATER-001", () => {
  it("classifies the golden query as the dedicated Antigua-first water workflow", () => {
    const result = classification();

    assert.equal(result.isProcedural, true);
    assert.equal(result.procedureType, "potable_water_project");
    assert.equal(result.mentionsExternalMunicipality, false);
    assert.ok(result.retrievalQueries.some((item) => /COCODE.*COMUDE/i.test(item)));
    assert.ok(result.retrievalQueries.some((item) => /operación.*mantenimiento.*continuidad/i.test(item)));
  });

  it("compiles exactly the 47 ordered research categories without treating them as facts", () => {
    const workflow = emptyWorkflow();

    assert.equal(workflow.procedureType, "potable_water_project");
    assert.equal(workflow.jurisdiction, "Antigua Guatemala");
    assert.deepEqual(
      workflow.steps.map((step) => step.title),
      EXPECTED_CATEGORIES
    );
    assert.equal(workflow.steps.length, 47);
    assert.equal(workflow.dependencies?.length, 46);
    assert.ok(workflow.steps.every((step) => step.evidenceStatus === "insufficient"));
    assert.ok(workflow.steps.every((step) => step.sourceEvidence.length === 0));
    assert.ok(workflow.steps.every((step) => step.legalBasis.length === 0));
    assert.ok(workflow.steps.every((step) => !step.responsibleRole));
    assert.ok(workflow.steps.every((step) => !step.responsibleUnit));
    assert.ok(workflow.steps.every((step) => !step.deadline));
    assert.ok(workflow.steps.every((step) => !step.decisionGate));
    assert.ok(workflow.steps.every((step) => step.notes?.includes(WATER_PENDING_SOURCE)));
    assert.match(workflow.summary, /47 categorías de investigación/);
    assert.match(workflow.validationWarning, /Borrador de investigación Antigua-first/);
  });

  it("maps all 47 steps to the canonical v1 contract with explicit missing evidence", async () => {
    const output = mapProcedureWorkflowV1({
      request,
      workflow: emptyWorkflow(),
      evidenceRecords: [],
      auditId: "55555555-5555-4555-8555-555555555555",
      credentialId: request.provenance.credential_id,
      createdAt: "2026-07-21T12:00:00.000Z",
    });
    const validators = await loadProcedureQueryContractValidators();

    assert.equal(validators.workflow(output), true, JSON.stringify(validators.workflow.errors));
    assert.equal(output.approval_status, "draft");
    assert.equal(output.product_boundary, "evidence_and_procedure_only");
    assert.deepEqual(output.sources, []);
    assert.deepEqual(output.citations, []);

    const steps = output.steps as Array<Record<string, unknown>>;
    assert.equal(steps.length, 47);
    for (const step of steps) {
      assert.equal(step.evidence_status, "missing_evidence");
      assert.equal(step.authority_status, "unknown");
      assert.equal(step.responsible_actor, null);
      assert.equal(step.responsible_unit, null);
      assert.equal(step.external_system, null);
      assert.equal(step.deadline, null);
      assert.equal(step.follow_up_cadence, null);
      assert.deepEqual(step.approvals, []);
      assert.deepEqual(step.legal_basis, []);
      assert.deepEqual(step.citation_refs, []);
      assert.ok(Array.isArray(step.preconditions));
      assert.ok(Array.isArray(step.required_documents));
      assert.ok(Array.isArray(step.output_documents));
      assert.ok(Array.isArray(step.completion_criteria));
      assert.ok((step.completion_criteria as unknown[]).length > 0);
      assert.ok(Array.isArray(step.risks));
      assert.ok((step.risks as unknown[]).length > 0);
      assert.ok((step.unknowns as string[]).includes(WATER_PENDING_SOURCE));
    }
    assert.equal((output.dependencies as unknown[]).length, 46);
    assert.match(JSON.stringify(output.gaps), /Fuente oficial de Antigua Guatemala/);
    assert.doesNotMatch(JSON.stringify(output), /estrategia electoral|calendario editorial|paid media/i);
  });

  it("supports only the category matched by a specific PDM-OT citation", () => {
    const evidence: EvidenceItem[] = [
      {
        documentTitle: "PDM-OT Antigua Guatemala",
        sourceType: "plan",
        citationLabel: "PDM-OT, página 170",
        pageStart: 170,
        excerpt: "El PDM-OT contiene lineamientos de ordenamiento territorial.",
        score: 0.9,
        retrievalMode: "keyword",
        sourceUrl: "https://muniantigua.gob.gt/pdm-ot.pdf",
      },
    ];
    const workflow = composeProcedureWorkflow(
      QUERY,
      "keyword",
      classification(),
      evidence,
      municipalAntiguaDomainPack,
      "deep_dive"
    );

    assert.deepEqual(
      workflow.steps.filter((step) => step.evidenceStatus === "supported").map((step) => step.title),
      ["PDM-OT"]
    );
    assert.equal(workflow.steps.filter((step) => step.sourceEvidence.length > 0).length, 1);
    assert.equal(workflow.steps.filter((step) => step.evidenceStatus === "insufficient").length, 46);
  });
});
