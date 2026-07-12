# LA Muni RAG

Last updated: 2026-07-11  
Status: Procedure Workflow Advisor MVP complete; domain-pack foundation active

LA Muni RAG is an evidence-first RAG and procedural workflow system configured by default for the Municipality of La Antigua Guatemala, Sacatepéquez. The core can now load validated domain packs so the same architecture can support other evidence-first procedural assistants.

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

### Domain intake

```text
/domain-intake.html
```

Prepares domain-aware document metadata and a local `backfillCorpus` command before indexing. It does not upload files or write to the backend.

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
GET  /api/domain-pack
GET  /api/procedure
POST /api/procedure-feedback
GET  /api/procedure-feedback
```

`/api/procedure-feedback` requires a configured Bearer token through `PROCEDURE_FEEDBACK_API_TOKEN`.

## Domain Packs

The active domain is selected with `DOMAIN_PACK`. If unset, the server defaults to:

```env
DOMAIN_PACK=municipal-antigua
```

Supported starter packs:

- `municipal-antigua`
- `hr`
- `finance`
- `sales-sop`
- `custom`

Unsupported values fail closed during startup/configuration validation. `/health` exposes a safe domain-pack summary without secrets.

`/api/domain-pack` exposes safe UI metadata for the active pack so public pages can adapt labels and default prompts without exposing runtime configuration or secrets.

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

The reusable RAG core and domain-pack contract now exist, but the repository is not yet a complete domain administration product.

Reusable today:

- PostgreSQL document registry;
- document versions;
- citable sections;
- keyword, phrase, and hybrid retrieval;
- evidence response contract;
- deterministic answer layer;
- chat API;
- domain-pack registry and validation;
- domain-aware procedural workflow classification and templates;
- source-link safety;
- feedback infrastructure;
- tests and harness workflow.

Still intentionally municipal or incomplete:

- public branding and Spanish municipal UI;
- seed documents and examples.
- document ingestion/admin is not yet pack-scoped in a public UI;
- starter HR/finance/sales/custom packs are templates, not deployed customer policy corpora.

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

The contract lives in `src/domain/types.ts`, the validated registry in `src/domain/registry.ts`, and starter packs in `src/domain/packs/`.

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
DOMAIN_PACK=municipal-antigua
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

## Domain-Aware Backfill

Corpus backfill accepts domain metadata flags:

```bash
node --import tsx src/cli/backfillCorpus.ts \
  --manifest .rag/corpus-manifest.json \
  --input corpus/document.md \
  --document-key document-key \
  --document-version v1 \
  --domain-pack municipal-antigua \
  --source-authority-class municipal_manual \
  --document-type manual \
  --confidentiality public
```

If `--domain-pack` is omitted, backfill defaults to `municipal-antigua`. Unsupported domain packs or source authority classes fail closed before indexing.

## Verification

```bash
npm run typecheck
npm run build
npm run domain:evaluate
npm run test
npm run build:pages
node scripts/verify-pages-artifact.mjs
```

## Current Limitation: Document Administration

Documents are registered and searched through PostgreSQL and ingestion scripts. The project includes a local domain-aware intake preparation page, but it does not yet include a complete document-library/admin UI for uploading, tagging, versioning, reviewing, and activating files.

That is why uploaded corpus documents do not currently appear as a visible library in the public frontend.

## Next Architectural Features

```text
047-domain-pack-admin-library
048-domain-pack-feedback-analytics
```

Likely next work: make public UI routing and document intake/admin flows fully pack-aware while preserving the Antigua-first default behavior.
