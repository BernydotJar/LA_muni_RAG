# Design — Municipal Procedure Workflow Advisor

## Product Shift

The existing RAG answers questions with citations. Feature 036 adds a procedural reasoning layer that turns retrieved evidence into a municipal workflow. The advisor remains evidence-first: it must not invent unsupported process steps.

## Architecture

```text
User query
  ↓
Procedure classifier
  ↓
Procedure retrieval plan
  ↓
Existing evidence retrieval
  ↓
Workflow composer
  ↓
Gap detector
  ↓
Structured procedure workflow response
```

## Components

### 1. Procedure Classifier

Classifies whether the query is procedural and maps it to one of:

- `public_works`
- `procurement`
- `project_execution`
- `project_closure`
- `budget`
- `community_request`
- `cocode`
- `council_approval`
- `unknown`

It also detects case references such as `San Mateo`, `escuela`, `obra`, `estadio`, `Mixco`, `COCODE`, and `Concejo`.

### 2. Procedure Retriever

Builds a retrieval plan without changing existing ranking. It expands the query with procedure-oriented terms and calls `findEvidenceWithDependencies` using the current evidence system.

For Antigua-first behavior, the composer/gap layer classifies sources and flags external references. The retrieval layer remains generic in this MVP.

### 3. Workflow Composer

Turns retrieved evidence into structured steps. In MVP, it uses conservative templates per procedure type and attaches all available evidence to relevant steps. A step without enough evidence is low confidence and carries a validation note.

### 4. Gap Detector

Identifies missing documents needed to complete or validate the flow. For example, project closure requires contract, acta de recepción, supervision reports, payment estimates, liquidation, budget file, and council/community evidence when applicable.

### 5. API Boundary

Add `/api/procedure` as a GET endpoint:

```text
/api/procedure?q=<query>&mode=hybrid&limit=8
```

It returns a structured `ProcedureWorkflow` JSON response. The existing `/api/chat` behavior remains unchanged.

## Authority Handling

The advisor is for Antigua Guatemala. The authority order is:

1. Antigua official documents.
2. National law or regulation applicable to all municipalities.
3. Case-specific evidence.
4. War room/proposal files for operational context only.
5. External municipal references for comparison only.

External references must be labeled as comparative and cannot become Antigua authority by themselves.

## Safety Rules

- Do not state exact deadlines unless a citation supports them.
- Do not state that a project is closed/open/approved unless case evidence supports it.
- Do not claim COCODE approval routes without evidence.
- Do not claim signatory count without evidence.
- Mark inferred steps as requiring human validation.
- Always include a validation warning.

## MVP Limitations

- This is not a legal expert system.
- It does not ingest new procedure PDFs automatically.
- It does not create a visual frontend workflow yet.
- It does not perform legal interpretation beyond evidence organization.
