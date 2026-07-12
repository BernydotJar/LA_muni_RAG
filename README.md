# LA Muni RAG

Last updated: 2026-07-11  
Status: Procedure Workflow Advisor MVP complete; reusable template extraction planned

LA Muni RAG is an evidence-first RAG and procedural workflow system currently configured for the Municipality of La Antigua Guatemala, Sacatepéquez.

The repository now does more than answer questions with citations. It can retrieve evidence, classify procedural questions, compose step-by-step workflows, expose gaps and missing documents, collect feedback, and persist controlled feedback through an authenticated backend API.

## Current Product Surfaces

### Public assistant

```text
/
```

Evidence-backed municipal Q&A through the embeddable chat widget.

### Procedure Workflow Advisor

```text
/procedure-workflow.html
```

Generates structured workflows with:

- summary;
- steps;
- required documents;
- output documents;
- confidence;
- citations;
- gaps;
- validation warnings;
- copyable checklist.

### Feedback dashboard

```text
/procedure-feedback-dashboard.html
```

Reviews locally captured ProcedureWorkflow feedback. Feedback remains product signal, not municipal evidence.

### Glass Wall

```text
/glass-wall.html
```

Technical view for observable retrieval behavior and evidence inspection.

## API Surface

```text
GET  /health
GET  /api/search
GET  /api/evidence
GET  /api/agent
GET  /api/answer
POST /api/chat
GET  /api/procedure
POST /api/procedure-feedback
GET  /api/procedure-feedback
```

`/api/procedure-feedback` requires a configured Bearer token through `PROCEDURE_FEEDBACK_API_TOKEN`.

## Current Antigua Configuration

The current domain pack is municipal and Antigua-first. It includes assumptions and terminology related to:

- public works;
- procurement;
- project execution;
- project closure;
- budget;
- COCODE/community requests;
- Concejo Municipal;
- official Antigua documents;
- national Guatemalan legislation;
- comparative `external reference` documents from other municipalities.

External municipal references are never presented as official Antigua procedure unless corroborated by Antigua documents or national law.

## Important Product Boundary

The reusable RAG core already exists, but the repository is not yet a fully domain-agnostic template.

Reusable today:

- PostgreSQL document registry;
- document versions;
- citable sections;
- keyword, phrase, and hybrid retrieval;
- evidence response contract;
- deterministic answer layer;
- chat API;
- source-link safety;
- feedback infrastructure;
- tests and harness workflow.

Still coupled to the municipal domain:

- procedure types;
- source authority classes;
- procedure classifier keywords;
- Antigua-first governance copy;
- municipal workflow templates;
- public branding and Spanish municipal UI;
- municipal feedback labels;
- seed documents and examples.

## Reusable Template Direction

The intended architecture is:

```text
RAG Core
  ├── retrieval
  ├── evidence
  ├── ingestion
  ├── workflow runtime
  ├── feedback
  ├── API
  └── security/governance

Domain Packs
  ├── municipal-antigua
  ├── hr
  ├── finance
  ├── sales-sop
  └── custom
```

A domain pack should define:

- branding;
- language;
- procedure/workflow types;
- source authority taxonomy;
- classifier vocabulary;
- workflow templates;
- validation rules;
- seed documents;
- example questions;
- UI labels;
- evaluation cases.

Examples:

### HR domain pack

Documents:

- employee handbook;
- onboarding SOP;
- leave policy;
- disciplinary process;
- benefits documentation;
- role descriptions.

Possible workflows:

- onboard a new employee;
- process a leave request;
- close an employee offboarding case;
- execute a disciplinary procedure;
- request a compensation adjustment.

### Finance domain pack

Documents:

- accounts payable SOP;
- expense policy;
- budget approval matrix;
- procurement rules;
- month-end close checklist;
- audit controls.

Possible workflows:

- process a vendor invoice;
- approve an expense;
- close the month;
- prepare an audit package;
- request a budget transfer.

### Sales SOP domain pack

Documents:

- qualification playbook;
- pricing policy;
- discount approval matrix;
- handoff SOP;
- proposal process;
- contracting checklist.

Possible workflows:

- qualify a lead;
- handle a pricing objection;
- request discount approval;
- hand off an opportunity;
- prepare a proposal;
- close a contract.

## Local Database

Recommended database name:

```text
la_muni_rag
```

Apply migrations in order:

```bash
psql "$DATABASE_URL" -f db/migrations/001_initial_rag_schema.sql
psql "$DATABASE_URL" -f db/migrations/002_procedure_feedback.sql
```

Initial seeds:

```bash
psql "$DATABASE_URL" -f db/seeds/001_core_documents.sql
psql "$DATABASE_URL" -f db/seeds/002_document_versions.sql
```

## Environment

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/la_muni_rag
PROCEDURE_FEEDBACK_API_TOKEN=replace-with-a-long-random-secret
```

Never place secrets in public frontend files or GitHub Pages assets.

## Run Locally

```bash
npm install
npm run dev:start
```

API default:

```text
http://localhost:4010
```

## Verification

```bash
npm run typecheck
npm run build
npm run test
npm run build:pages
node scripts/verify-pages-artifact.mjs
```

## Current Limitation: Document Administration

Documents are registered and searched through PostgreSQL and ingestion scripts. The project does not yet include a complete document-library/admin UI for uploading, tagging, versioning, reviewing, and activating files.

That is why uploaded corpus documents do not currently appear as a visible library in the public frontend.

## Next Architectural Feature

```text
042-domain-pack-template-foundation
```

This feature should extract Antigua-specific behavior into a `municipal-antigua` domain pack and create a neutral template contract for HR, finance, sales SOPs, and other document-driven procedural assistants.
