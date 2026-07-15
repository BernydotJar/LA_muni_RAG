# Requirements — Procedure Deep Dive

## Goal

Extend the existing Procedure Workflow Advisor with a reviewable deep-dive contract that explains query intent, retrieval lanes, evidence sufficiency, dependencies, decisions, deadlines, and validation requirements without replacing the current RAG or inventing procedure.

## Functional Requirements

1. Classify each request into one primary intent:
   - `documentary_query`
   - `legal_query`
   - `procedural_query`
   - `case_specific_query`
   - `planning_query`
   - `closure_query`
2. Build separate retrieval lanes for:
   - normative/procedural evidence;
   - case-specific evidence;
   - community/planning context;
   - comparative external references.
3. Preserve the current `/api/procedure` response fields and add backwards-compatible deep-dive metadata.
4. Each procedure step must expose:
   - dependencies;
   - decision points;
   - explicit evidence status;
   - deadline status distinguishing cited, not found, and not applicable.
5. The workflow must expose evidence diagnostics by authority class and retrieval lane.
6. External municipal references must remain comparative and cannot establish an Antigua procedure without local or applicable national corroboration.
7. When a step lacks support, use the stable message: `No encontré base documental suficiente para afirmar este paso.`
8. Inferred steps must use the stable message: `Este paso es inferido por relación entre documentos y requiere validación humana.`
9. No legal advice, automatic publication, corpus mutation, database migration, dependency installation, or production deployment is included.

## Acceptance Criteria

- Existing procedure tests remain compatible.
- New focused tests cover intent classification, retrieval lanes, unsupported-step wording, inferred-step wording, deadline status, and external-reference governance.
- Typecheck and build pass.
- Full domain evaluation and test suite pass.
- Pages build remains unchanged except for generated artifacts.
