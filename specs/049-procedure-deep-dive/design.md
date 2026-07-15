# Design — Procedure Deep Dive

## Existing Baseline

The repository already has a domain-aware Procedure Workflow Advisor composed of query classification, multi-query evidence retrieval, workflow templates, gap detection, authority classification, and a structured `/api/procedure` response.

## Increment

Feature 049 deepens that contract without replacing it.

### Query Understanding

`ProcedureQueryClassification` gains a primary `queryIntent` and a structured `retrievalPlan`. Existing booleans and `retrievalQueries` remain for compatibility.

### Retrieval Lanes

The retriever executes bounded lane-specific queries and records the lane that produced each evidence item. The composer receives a diagnostic summary, while citation deduplication remains deterministic.

### Step Evidence State

Each step gains:

- `dependencies: string[]`
- `decisionPoints: string[]`
- `evidenceStatus: supported | inferred | unsupported`
- `evidenceMessage: string`
- `deadlineStatus: cited | not_found | not_applicable`

Templates remain conservative. A step is supported only when matched evidence exists. A fallback citation does not silently convert an unmatched template step into a supported step.

### Workflow Diagnostics

The workflow gains a `deepDive` object containing:

- primary query intent;
- executed retrieval lanes;
- evidence counts by authority class;
- supported/inferred/unsupported step counts;
- governance warnings.

### Safety

External references remain comparative. Unsupported steps use a stable refusal sentence. Inferred steps are explicitly labeled and require human validation. Deadlines are emitted only when explicitly present in evidence; this feature does not parse or synthesize dates beyond that contract.

## Compatibility

All additions are optional or additive at the transport level. Existing top-level workflow fields, endpoint path, and domain-pack templates remain unchanged.
