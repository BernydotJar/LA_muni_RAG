# LA Muni RAG

Last updated: 2026-07-19
Status: Pre-production hardening in progress; controlled artifact, bounded
raw-PDF, tenant-query, authenticated ingestion API, and durable tenant
ingestion/vector worker foundations implemented

LA Muni RAG is an evidence-first RAG and procedural workflow system configured by default for the Municipality of La Antigua Guatemala, Sacatepéquez. Its core supports validated domain packs so the same architecture can be reused for HR, finance, sales SOPs, and custom procedural assistants.

## Product Surfaces

- `/` — public evidence-backed assistant.
- `/procedure-workflow.html` — structured Procedure Workflow Advisor.
- `/domain-intake.html` — prepares domain-aware ingestion metadata and commands; it does not upload files.
- `/procedure-feedback-dashboard.html` — reviews locally captured workflow feedback.
- `/glass-wall.html` — technical evidence and retrieval inspection.

## API Surface

```text
GET  /health
POST /api/v1/procedure-queries
POST /api/v1/ingestion-jobs
GET  /api/v1/ingestion-jobs/{job_id}
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

`/api/procedure-feedback` requires a Bearer token configured through `PROCEDURE_FEEDBACK_API_TOKEN`.

`POST /api/v1/procedure-queries` is the authenticated, tenant-scoped production
slice. Production disables every pre-v1 `/api/*` route; the legacy routes listed
above are development-only and must not be exposed with confidential or
multi-tenant data. The ingestion v1 route family authenticates
`document:ingest` and enqueues/reads jobs only for existing registry versions;
it is not an upload or artifact-acceptance API. A bounded worker class exists,
but no storage/scanner adapter, worker process, or deployment exists.

## Domain Packs

Select the active pack with:

```env
DOMAIN_PACK=municipal-antigua
```

Supported starter packs:

- `municipal-antigua`
- `hr`
- `finance`
- `sales-sop`
- `custom`

Unsupported values fail closed. `/health` and `/api/domain-pack` expose safe pack metadata without exposing secrets.

The reusable architecture is:

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

The contract lives in `src/domain/types.ts`, the validated registry in `src/domain/registry.ts`, and starter packs in `src/domain/packs/`.

## Current Antigua Reference Implementation

The municipal pack includes public works, procurement, project execution, project closure, budget, community requests, COCODE, Concejo Municipal, national law, Antigua official sources, and external municipal references.

External references remain comparative and are never presented as official Antigua procedure without corroboration from Antigua documents or applicable national law.

## Workflow Template Authoring

Feature `047-workflow-template-editor-foundation` adds a controlled JSON-based authoring foundation without changing the active runtime templates.

The editable contract validates:

- domain-pack ownership;
- safe workflow and step ids;
- existing workflow types;
- contiguous step order;
- labels and actions;
- required and output documents;
- source-authority classes;
- governance rules;
- evidence requirements;
- human-validation checkpoints.

Validate the reviewable example:

```bash
npm run workflow:validate -- examples/workflow-templates/municipal-antigua.public-works.json
```

The validator is read-only. It accepts only repository-local JSON, performs no dynamic import or code execution, writes nothing, publishes nothing, and never converts feedback automatically into authoritative procedure.

Detailed guide:

```text
docs/workflow-template-editor-foundation.md
```

## Domain Pack Bootstrap CLI

Feature `048-template-bootstrap-cli` scaffolds an inactive, reviewable draft pack under the fixed path `domain-packs/<id>/`.

Preview the exact file plan without writing:

```bash
npm run domain:init -- \
  --id legal \
  --name "Legal Procedure Assistant" \
  --language es \
  --dry-run
```

Create the scaffold after reviewing the plan:

```bash
npm run domain:init -- \
  --id legal \
  --name "Legal Procedure Assistant" \
  --language es
```

The CLI accepts only safe lowercase kebab-case ids, rejects reserved and existing targets, never accepts an arbitrary output path, and never overwrites files. Generated manifests remain `status: "draft"` and `authoritative: false`; workflow templates start empty and the pack is not added to the runtime registry automatically.

Detailed guide:

```text
docs/domain-pack-bootstrap-cli.md
```

## Domain-Aware Document Intake

Corpus backfill accepts domain metadata:

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

If `--domain-pack` is omitted, backfill defaults to `municipal-antigua`. Unsupported packs or authority classes fail closed before indexing.

## Local Database

Recommended database:

```text
la_muni_rag
```

Apply migrations in order:

```bash
psql "$DATABASE_URL" -f db/migrations/001_initial_rag_schema.sql
psql "$DATABASE_URL" -f db/migrations/002_procedure_feedback.sql
psql "$DATABASE_URL" -f db/migrations/003_identity_tenancy_rbac.sql
psql "$DATABASE_URL" -f db/migrations/004_procedure_query_api.sql
psql "$DATABASE_URL" -f db/migrations/005_tenant_ingestion_runtime.sql
psql "$DATABASE_URL" -f db/migrations/006_ingestion_api_runtime.sql
```

Migration `005` is the canonical vector-store migration. Do not apply
`migrations/011-production-vector-store.sql` on a fresh database; it exists only
for historical upgrade reproduction. Unscoped legacy rows halt migration for an
explicit reviewed ownership mapping.

Initial seeds:

```bash
psql "$DATABASE_URL" -f db/seeds/001_core_documents.sql
psql "$DATABASE_URL" -f db/seeds/002_document_versions.sql
```

The seeds set the explicit legacy/bootstrap tenant transaction-locally so they
continue to fail closed under forced RLS. That tenant is only a migration bridge;
review and reassign seeded ownership before onboarding another tenant.

## Environment

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/la_muni_rag
DOMAIN_PACK=municipal-antigua
PROCEDURE_FEEDBACK_API_TOKEN=replace-with-a-long-random-secret
```

Never place secrets in frontend files or GitHub Pages assets.

## Run Locally

```bash
npm install
npm run dev:start
```

Default API:

```text
http://localhost:4010
```

## Verification

```bash
npm run typecheck
npm run build
npm run domain:evaluate
npm run test
npm run build:pages
node scripts/verify-pages-artifact.mjs
```

`dist-pages/` contains generated Pages output. After local verification, restore tracked content and remove only generated untracked files before confirming a clean working tree.

## Current Boundaries

Reusable today:

- PostgreSQL document registry and versions;
- citable sections;
- keyword, phrase, and hybrid retrieval;
- evidence-first response contracts;
- domain-pack registry and validation;
- domain-aware workflow classification and composition;
- source-link safety;
- controlled feedback infrastructure;
- deterministic domain-pack evaluation;
- validated JSON workflow-template authoring foundation;
- deterministic draft domain-pack bootstrap CLI.
- controlled local artifact import/inspection/quarantine operations;
- bounded page-cited raw-PDF extraction after accepted safety evidence.
- digest-bound durable ingestion jobs with bounded leases/retries and stale-worker
  fencing;
- tenant-scoped, job/version-bound vector generations with atomic replacement and
  eligible public search.
- authenticated, rate-limited enqueue/status contracts for existing document
  versions, with server-owned pipeline policy and non-leaking status reads;
- a callable worker that accepts only injected immutable, clean-scan-bound bytes
  and rechecks their identity before atomic completion.

Still intentionally incomplete:

- complete authenticated document-library/admin UI;
- browser-based file upload and ingestion;
- production ClamAV/runtime sandbox and durable object storage;
- approved immutable object-storage/scanner-evidence adapter and authenticated
  administrative upload/version-acceptance flow;
- separately packaged/deployed worker with workload identity, tenant routing,
  cancellation/deadline, backpressure, monitoring, and graceful shutdown;
- production DB role attestation, queue/observability, load/HA, and reviewed
  tenant-partitioned approximate-vector strategy if scale requires it;
- automatic workflow-template publication;
- visual workflow-template editor;
- real customer HR, finance, or sales policy corpora;
- final reusable-template hardening and documentation.

Starter packs and generated scaffolds are templates. They must not be treated as authoritative organizational policy until populated, evidenced, reviewed, and approved by the relevant domain owner.

See [Tenant Vector and Ingestion Runtime](docs/tenant-ingestion-runtime.md) for
the durable job/vector contract, local PostgreSQL gate, and remaining production
boundary, and [Ingestion jobs API v1](docs/api/ingestion-jobs-v1.md) for the
authenticated enqueue/status contract.
