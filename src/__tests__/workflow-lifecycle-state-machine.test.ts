import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  approveReplacementAndSupersede,
  approveWorkflowVersion,
  archiveWorkflowVersion,
  initializeWorkflowVersion,
  recordWorkflowReview,
  reviseWorkflowDraft,
  submitWorkflowForReview,
  supersedeWorkflowVersion,
  WorkflowLifecycleError,
} from "../workflowLifecycle/stateMachine.js";
import type { WorkflowLifecycleActor, WorkflowVersionRecord } from "../workflowLifecycle/types.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const PROCEDURE_ID = "22222222-2222-4222-8222-222222222222";
const VERSION_ID = "33333333-3333-4333-8333-333333333333";
const CREATOR_ID = "44444444-4444-4444-8444-444444444444";
const REVIEWER_ID = "55555555-5555-4555-8555-555555555555";
const APPROVER_ID = "66666666-6666-4666-8666-666666666666";
const REPLACEMENT_ID = "77777777-7777-4777-8777-777777777777";
const REVIEW_ID = "88888888-8888-4888-8888-888888888888";
const APPROVAL_ID = "99999999-9999-4999-8999-999999999999";
const REPLACEMENT_REVIEW_ID = "10101010-1010-4010-8010-101010101010";
const REPLACEMENT_APPROVAL_ID = "12121212-1212-4212-8212-121212121212";
const OTHER_PROCEDURE_ID = "13131313-1313-4313-8313-131313131313";
const NOW = "2026-07-21T10:00:00.000Z";

const actor = (
  principalId: string,
  roles: WorkflowLifecycleActor["roles"]
): WorkflowLifecycleActor => ({ principalId, tenantId: TENANT_ID, roles });

const creator = actor(CREATOR_ID, ["procedure_author"]);
const reviewer = actor(REVIEWER_ID, ["procedure_reviewer"]);
const approver = actor(APPROVER_ID, ["procedure_approver"]);

const draft = (generationSource: "ai" | "human" | "import" = "ai"): WorkflowVersionRecord =>
  initializeWorkflowVersion({
    workflowVersionId: VERSION_ID,
    tenantId: TENANT_ID,
    procedureId: PROCEDURE_ID,
    versionNumber: 1,
    generationSource,
    createdByPrincipalId: CREATOR_ID,
    jurisdiction: "Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala",
    title: "Recepción y revisión documental de solicitud comunitaria",
    workflowDefinition: {
      schema_version: "v1",
      approval_status: "draft",
      steps: [{ step_id: "step-1", evidence_status: "supported" }],
    },
    now: NOW,
  });

const recommended = (): WorkflowVersionRecord =>
  recordWorkflowReview(
    submitWorkflowForReview(draft(), creator, "2026-07-21T10:05:00Z"),
    reviewer,
    {
      reviewId: REVIEW_ID,
      decision: "recommended_for_approval",
      notes: "La evidencia y las limitaciones fueron revisadas; se recomienda aprobación humana.",
      now: "2026-07-21T10:10:00Z",
    }
  );

const recommendedReplacement = (): WorkflowVersionRecord => {
  const replacement = initializeWorkflowVersion({
    workflowVersionId: REPLACEMENT_ID,
    tenantId: TENANT_ID,
    procedureId: PROCEDURE_ID,
    versionNumber: 2,
    generationSource: "human",
    createdByPrincipalId: CREATOR_ID,
    jurisdiction: "Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala",
    title: "Versión revisada para sustituir el workflow vigente",
    workflowDefinition: {
      schema_version: "v1",
      approval_status: "draft",
      steps: [{ step_id: "step-1", evidence_status: "supported", revision: 2 }],
    },
    now: "2026-07-21T10:16:00Z",
  });
  return recordWorkflowReview(
    submitWorkflowForReview(replacement, creator, "2026-07-21T10:17:00Z"),
    reviewer,
    {
      reviewId: REPLACEMENT_REVIEW_ID,
      decision: "recommended_for_approval",
      notes: "La replacement fue revisada como una versión nueva y distinta.",
      now: "2026-07-21T10:18:00Z",
    }
  );
};

const expectCode = (operation: () => unknown, code: string): void => {
  assert.throws(
    operation,
    (error) => error instanceof WorkflowLifecycleError && error.code === code
  );
};

describe("workflow lifecycle state machine", () => {
  it("starts AI, human, and imported workflow versions as draft", () => {
    for (const source of ["ai", "human", "import"] as const) {
      const record = draft(source);
      assert.equal(record.lifecycleStatus, "draft");
      assert.equal(record.generationSource, source);
      assert.equal(record.approval, null);
      assert.equal(record.latestReview, null);
    }
  });

  it("allows only an author to revise a draft and keeps immutable inputs cloned", () => {
    const originalDefinition = { steps: [{ title: "Original" }] };
    const original = initializeWorkflowVersion({
      workflowVersionId: VERSION_ID,
      tenantId: TENANT_ID,
      procedureId: PROCEDURE_ID,
      versionNumber: 1,
      generationSource: "ai",
      createdByPrincipalId: CREATOR_ID,
      jurisdiction: "Antigua Guatemala",
      title: "Borrador inicial",
      workflowDefinition: originalDefinition,
      now: NOW,
    });
    originalDefinition.steps[0]!.title = "Mutated caller state";
    assert.deepEqual(original.workflowDefinition, { steps: [{ title: "Original" }] });

    const nextDefinition = { steps: [{ title: "Revisado" }] };
    const revised = reviseWorkflowDraft(original, creator, {
      title: "Borrador revisado",
      workflowDefinition: nextDefinition,
      now: "2026-07-21T10:01:00Z",
    });
    nextDefinition.steps[0]!.title = "Mutated after call";
    assert.equal(revised.revision, 2);
    assert.equal(revised.title, "Borrador revisado");
    assert.deepEqual(revised.workflowDefinition, { steps: [{ title: "Revisado" }] });
    assert.equal(original.revision, 1);

    expectCode(
      () => reviseWorkflowDraft(original, reviewer, {
        workflowDefinition: {},
        now: "2026-07-21T10:02:00Z",
      }),
      "workflow_authorization_denied"
    );
  });

  it("submits a draft for review without approving it", () => {
    const submitted = submitWorkflowForReview(draft(), creator, "2026-07-21T10:05:00Z");
    assert.equal(submitted.lifecycleStatus, "in_review");
    assert.equal(submitted.submittedByPrincipalId, CREATOR_ID);
    assert.equal(submitted.approval, null);
    assert.equal(draft().lifecycleStatus, "draft");
  });

  it("returns changes-requested workflows to draft while preserving review evidence", () => {
    const submitted = submitWorkflowForReview(draft(), creator, "2026-07-21T10:05:00Z");
    const reviewed = recordWorkflowReview(submitted, reviewer, {
      reviewId: REVIEW_ID,
      decision: "changes_requested",
      notes: "Falta resolver el conflicto documental y confirmar la versión aplicable.",
      now: "2026-07-21T10:10:00Z",
    });
    assert.equal(reviewed.lifecycleStatus, "draft");
    assert.equal(reviewed.latestReview?.decision, "changes_requested");
    assert.equal(reviewed.submittedAt, null);
    assert.equal(reviewed.approval, null);
  });

  it("requires a recommended review before approval", () => {
    const submitted = submitWorkflowForReview(draft(), creator, "2026-07-21T10:05:00Z");
    expectCode(
      () => approveWorkflowVersion(submitted, approver, {
        approvalId: APPROVAL_ID,
        notes: "Approve",
        now: "2026-07-21T10:15:00Z",
      }),
      "workflow_review_required"
    );
  });

  it("enforces creator, reviewer, and approver separation of duties", () => {
    const submitted = submitWorkflowForReview(draft(), creator, "2026-07-21T10:05:00Z");
    expectCode(
      () => recordWorkflowReview(
        submitted,
        actor(CREATOR_ID, ["procedure_reviewer"]),
        {
          reviewId: REVIEW_ID,
          decision: "recommended_for_approval",
          notes: "Self review",
          now: "2026-07-21T10:10:00Z",
        }
      ),
      "workflow_separation_of_duties"
    );

    const reviewed = recommended();
    expectCode(
      () => approveWorkflowVersion(
        reviewed,
        actor(REVIEWER_ID, ["procedure_approver"]),
        {
          approvalId: APPROVAL_ID,
          notes: "Self approval after review",
          now: "2026-07-21T10:15:00Z",
        }
      ),
      "workflow_separation_of_duties"
    );
    expectCode(
      () => approveWorkflowVersion(
        reviewed,
        actor(CREATOR_ID, ["procedure_approver"]),
        {
          approvalId: APPROVAL_ID,
          notes: "Creator approval",
          now: "2026-07-21T10:15:00Z",
        }
      ),
      "workflow_separation_of_duties"
    );
  });

  it("approves only after distinct human review and preserves the workflow definition", () => {
    const reviewed = recommended();
    const before = structuredClone(reviewed.workflowDefinition);
    const approved = approveWorkflowVersion(reviewed, approver, {
      approvalId: APPROVAL_ID,
      notes: "Aprobado para publicación controlada dentro de la jurisdicción indicada.",
      now: "2026-07-21T10:15:00Z",
    });
    assert.equal(approved.lifecycleStatus, "approved");
    assert.equal(approved.approval?.approverPrincipalId, APPROVER_ID);
    assert.deepEqual(approved.workflowDefinition, before);
    assert.equal(reviewed.lifecycleStatus, "in_review");
    expectCode(
      () => reviseWorkflowDraft(approved, creator, {
        workflowDefinition: { changed: true },
        now: "2026-07-21T10:16:00Z",
      }),
      "workflow_transition_invalid"
    );
  });

  it("supersedes only an approved version and requires another version id", () => {
    const approved = approveWorkflowVersion(recommended(), approver, {
      approvalId: APPROVAL_ID,
      notes: "Approved",
      now: "2026-07-21T10:15:00Z",
    });
    const superseded = supersedeWorkflowVersion(approved, approver, {
      replacementWorkflowVersionId: REPLACEMENT_ID,
      now: "2026-07-21T10:20:00Z",
    });
    assert.equal(superseded.lifecycleStatus, "superseded");
    assert.equal(superseded.supersededByWorkflowVersionId, REPLACEMENT_ID);
    expectCode(
      () => supersedeWorkflowVersion(approved, approver, {
        replacementWorkflowVersionId: VERSION_ID,
        now: "2026-07-21T10:20:00Z",
      }),
      "workflow_supersession_invalid"
    );
    expectCode(
      () => supersedeWorkflowVersion(draft(), approver, {
        replacementWorkflowVersionId: REPLACEMENT_ID,
        now: "2026-07-21T10:20:00Z",
      }),
      "workflow_transition_invalid"
    );
  });

  it("approves a reviewed replacement and supersedes the current version atomically", () => {
    const current = approveWorkflowVersion(recommended(), approver, {
      approvalId: APPROVAL_ID,
      notes: "Current approved workflow",
      now: "2026-07-21T10:15:00Z",
    });
    const replacement = recommendedReplacement();
    const result = approveReplacementAndSupersede(current, replacement, approver, {
      replacementWorkflowVersionId: REPLACEMENT_ID,
      approvalId: REPLACEMENT_APPROVAL_ID,
      notes: "Approve the reviewed replacement while superseding the former version.",
      now: "2026-07-21T10:20:00Z",
    });

    assert.equal(result.superseded.lifecycleStatus, "superseded");
    assert.equal(result.superseded.supersededByWorkflowVersionId, REPLACEMENT_ID);
    assert.equal(result.replacement.lifecycleStatus, "approved");
    assert.equal(result.replacement.approval?.approvalId, REPLACEMENT_APPROVAL_ID);
    assert.equal(result.replacement.approval?.approverPrincipalId, APPROVER_ID);
    assert.equal(current.lifecycleStatus, "approved");
    assert.equal(replacement.lifecycleStatus, "in_review");

    expectCode(
      () => approveReplacementAndSupersede(
        current,
        { ...replacement, procedureId: OTHER_PROCEDURE_ID },
        approver,
        {
          replacementWorkflowVersionId: REPLACEMENT_ID,
          approvalId: REPLACEMENT_APPROVAL_ID,
          notes: "Wrong procedure",
          now: "2026-07-21T10:20:00Z",
        }
      ),
      "workflow_supersession_invalid"
    );
    expectCode(
      () => approveReplacementAndSupersede(current, {
        ...replacement,
        lifecycleStatus: "draft",
        latestReview: null,
      }, approver, {
        replacementWorkflowVersionId: REPLACEMENT_ID,
        approvalId: REPLACEMENT_APPROVAL_ID,
        notes: "Unreviewed replacement",
        now: "2026-07-21T10:20:00Z",
      }),
      "workflow_transition_invalid"
    );
  });

  it("allows authorized archival and makes archived state terminal", () => {
    const archived = archiveWorkflowVersion(draft(), approver, "2026-07-21T10:30:00Z");
    assert.equal(archived.lifecycleStatus, "archived");
    assert.equal(archived.archivedByPrincipalId, APPROVER_ID);
    expectCode(
      () => archiveWorkflowVersion(archived, approver, "2026-07-21T10:31:00Z"),
      "workflow_transition_invalid"
    );
  });

  it("denies cross-tenant transitions without leaking workflow state", () => {
    const otherTenantActor: WorkflowLifecycleActor = {
      principalId: REVIEWER_ID,
      tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      roles: ["procedure_reviewer"],
    };
    expectCode(
      () => recordWorkflowReview(
        submitWorkflowForReview(draft(), creator, "2026-07-21T10:05:00Z"),
        otherTenantActor,
        {
          reviewId: REVIEW_ID,
          decision: "recommended_for_approval",
          notes: "Cross tenant",
          now: "2026-07-21T10:10:00Z",
        }
      ),
      "workflow_tenant_denied"
    );
  });

  it("rejects oversized or non-JSON workflow definitions", () => {
    expectCode(
      () => initializeWorkflowVersion({
        workflowVersionId: VERSION_ID,
        tenantId: TENANT_ID,
        procedureId: PROCEDURE_ID,
        versionNumber: 1,
        generationSource: "ai",
        createdByPrincipalId: CREATOR_ID,
        jurisdiction: "Antigua Guatemala",
        title: "Oversized",
        workflowDefinition: { payload: "x".repeat(2 * 1024 * 1024) },
        now: NOW,
      }),
      "workflow_definition_invalid"
    );

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expectCode(
      () => initializeWorkflowVersion({
        workflowVersionId: VERSION_ID,
        tenantId: TENANT_ID,
        procedureId: PROCEDURE_ID,
        versionNumber: 1,
        generationSource: "ai",
        createdByPrincipalId: CREATOR_ID,
        jurisdiction: "Antigua Guatemala",
        title: "Cyclic",
        workflowDefinition: cyclic,
        now: NOW,
      }),
      "workflow_definition_invalid"
    );
  });
});
