# LA Muni RAG

Last updated: 2026-07-22
Status: Pre-production hardening in progress; controlled artifact, bounded
raw-PDF, tenant-query, authenticated ingestion, durable tenant ingestion/vector,
and governed workflow lifecycle API foundations implemented

LA Muni RAG is an evidence-first RAG and procedural workflow system configured by default for the Municipality of La Antigua Guatemala, Sacatepéquez. Its core supports validated domain packs so the same architecture can be reused for HR, finance, sales SOPs, and custom procedural assistants.

## Product Surfaces

- `/` — public product shell with direct Assistant and Glass Wall navigation. The assistant fails closed until a reviewed public gateway is configured.
- `/procedure-training.html` — public evidence-literacy Academy.
- `/procedure-workflow.html` — structured Procedure Workflow Advisor; production-compatible public gateway pending.
- `/domain-intake.html` — prepares domain-aware ingestion metadata and commands; it does not upload files.
- `/procedure-feedback-dashboard.html` — reviews locally captured workflow feedback.
- `/glass-wall.html` — technical evidence and retrieval inspection.

## API Surface

```text
GET  /health
GET  /api/v1/sources
POST /api/v1/sources
GET  /api/v1/documents
POST /api/v1/documents
GET  /api/v1/ingestion-jobs
POST /api/v1/ingestion-jobs
GET  /api/v1/ingestion-jobs/{job_id}
GET  /api/v1/procedures
POST /api/v1/search
POST /api/v1/evidence-bundles
POST /api/v1/procedure-queries
POST /api/v1/evidence-gap-requests
POST /api/v1/claim-packs
POST /api/v1/workflow-drafts
POST /api/v1/workflow-reviews
POST /api/v1/workflow-approvals
GET  /api/v1/workflows/{workflow_version_id}
# Development-only legacy surface; production returns 404
GET  /api/search
GET  /api/evidence
GET  /api/agent
GET  /api/answer
POST /api/chat
GET  /api/domain-pack
GET  /api/procedure
POST /api/procedure-feedback
GET  /api/procedure-feedback

# Public browser boundary; disabled by default until configured with a reviewed public corpus
POST /api/public/v1/query
```

`/api/procedure-feedback` requires a Bearer token configured through `PROCEDURE_FEEDBACK_API_TOKEN`.

`POST /api/public/v1/query` is the credential-free browser boundary. It accepts only `message`, `mode` (`keyword` or `phrase`), and `limit`; tenant, jurisdiction, date, evidence eligibility and database identity are server configuration. It requires an exact Origin, rejects Authorization/Cookie and tenant fields, uses HMAC-based per-client plus global rate buckets, returns public citations or an explicit no-evidence state, and is disabled unless all `PUBLIC_QUERY_*` settings are present. Enabling the route does not create or approve a corpus.


The catalog route family registers tenant sources and document versions in fail-closed states and exposes minimized source, document, ingestion-job, and procedure summaries. It does not accept artifact bytes or let callers declare officiality, validation, scan, ingestion, retrieval, or legal applicability.

`POST /api/v1/search` executes an explicit keyword, phrase, semantic, or hybrid mode over eligible public evidence. Semantic and hybrid requests fail closed with `503 capability_unavailable` when the configured query-embedding capability is missing, incompatible, or fails; the API never labels a lexical-only response as semantic or hybrid. `POST /api/v1/evidence-bundles` creates the canonical documentary bundle from the same classified evidence, promotes only supported exact excerpts to ordinary claims, preserves comparative references as citations/gaps, and requires exact idempotent replay. These local gates do not prove real-corpus quality, legal validity, consumer interoperability, or deployment.

`POST /api/v1/procedure-queries` is the authenticated, tenant-scoped production
slice. According to `requested_output`, it returns an identity-bound
`EvidenceBundle`, an AI-generated `ProcedureWorkflow` draft, or a conservative
`ProcedureAssessment` of that draft and the caller's case context. The assessment
never treats opaque provided-document IDs as validated completion and does not
prove legal compliance, approval, budget, procurement, or execution.
`POST /api/v1/evidence-gap-requests` records an immutable, tenant-scoped `open`
documentary research need from OS Electoral. It supports exact replay and
aggregate dedupe but never declares a source official, current, applicable,
acquired, ingested, or resolved.
`POST /api/v1/claim-packs` is a separate
Content-Agency-facing provider that emits claims/citations/usage limits only and
rejects copy, assets, channels, publication tasks, and campaign strategy. Production disables every pre-v1 `/api/*` route;
the legacy routes listed above are development-only and must not be exposed with
confidential or multi-tenant data. The ingestion v1 route family authenticates
`document:ingest` and enqueues/reads jobs only for existing registry versions;
it is not an upload or artifact-acceptance API. The workflow lifecycle route
family persists tenant-owned drafts, reviews, approvals, supersession, and archival
with action-specific RBAC, human separation of duties, exact replay, and
non-enumerating reads. Approval state does not prove legal validity or institutional
execution. A bounded ingestion worker class exists, but no storage/scanner adapter,
worker process, workflow UI, or deployment exists.

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
psql "$DATABASE_URL" -f db/migrations/007_persisted_artifact_acceptance.sql
psql "$DATABASE_URL" -f db/migrations/008_claim_pack_api.sql
psql "$DATABASE_URL" -f db/migrations/009_workflow_lifecycle.sql
psql "$DATABASE_URL" -f db/migrations/010_workflow_lifecycle_api.sql
psql "$DATABASE_URL" -f db/migrations/011_artifact_vector_runtime_hardening.sql
psql "$DATABASE_URL" -f db/migrations/012_evidence_gap_requests.sql
psql "$DATABASE_URL" -f db/migrations/013_procedure_cases.sql
psql "$DATABASE_URL" -f db/migrations/014_catalog_api.sql
psql "$DATABASE_URL" -f db/migrations/015_search_evidence_api.sql
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
QUERY_EMBEDDING_PROVIDER=http
QUERY_EMBEDDING_ENDPOINT=https://provider.example/v1/embeddings
QUERY_EMBEDDING_API_KEY=inject-from-secret-manager
QUERY_EMBEDDING_MODEL=reviewed-model-name
QUERY_EMBEDDING_DIMENSIONS=1536
QUERY_EMBEDDING_TIMEOUT_MS=10000
```

Never place secrets in frontend files or GitHub Pages assets. GitHub Pages may receive a non-secret `PAGES_API_URL` build variable, but it must point to the dedicated public gateway. The authenticated tenant APIs and their Bearer credentials are never browser configuration.

## Run Locally

```bash
npm ci
cp .env.example .env
# Configure a disposable/local DATABASE_URL before starting the API.
npm run dev:start
```

Default API:

```text
http://localhost:4010
```

## Verification

```bash
npm run contracts:validate
npm run contracts:consumer-verify
npm run staging:verify
npm run eval:staging-e2e-architecture
npm run eval:production-public-surface
npm run eval:public-query-gateway
npm run eval:search-api
npm run eval:evidence-bundle-api
npm run typecheck
npm run build
npm run domain:evaluate
npm run test
npm run build:pages
node scripts/verify-pages-artifact.mjs
# Optional local wiring only:
PAGES_API_URL=http://localhost:4000 npm run build:pages
```

Without `PAGES_API_URL`, Pages intentionally renders the product but disables queries and returns a bounded 503 for approved API calls. The default widget path is `/api/public/v1/query`; the backend route now exists but remains disabled by default and must be bound to an authorized reviewed public corpus before Pages is configured. It is not the legacy `/api/chat` route.

`dist-pages/` contains generated Pages output. After local verification, restore tracked content and remove only generated untracked files before confirming a clean working tree.

## Current Boundaries

Reusable today:

- PostgreSQL document registry and versions;
- citable sections;
- authenticated keyword, phrase, semantic, and hybrid retrieval with explicit score semantics and fail-closed semantic capability;
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
  eligible public search;
- dedicated Search and EvidenceBundle v1 routes with accepted-artifact eligibility,
  derived authority/temporal state, comparative non-promotion, exact replay, and
  non-owner PostgreSQL gates.
- authenticated, rate-limited enqueue/status contracts for existing document
  versions, with server-owned pipeline policy and non-leaking status reads;
- explicit visibility for same-document citation slots whose distinct versions
  contain different text, with review-required contradictions and no silent promotion;
- tenant-scoped workflow lifecycle tables and authenticated v1 draft/review/
  approval/read APIs with deterministic transitions, exact replay, forced RLS,
  bounded audit, and human separation of duties;
- immutable tenant-scoped EvidenceGapRequest intake with dedicated replay/rate
  state, aggregate identity conflict handling, canonical response validation and
  non-owner PostgreSQL gates;
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
- authenticated lifecycle UI, accessibility, external consumer interoperability,
  and production-shaped load/HA/observability evidence;
- automatic workflow-template publication;
- visual workflow-template editor;
- real customer HR, finance, or sales policy corpora;
- final reusable-template hardening and documentation.

Starter packs and generated scaffolds are templates. They must not be treated as authoritative organizational policy until populated, evidenced, reviewed, and approved by the relevant domain owner.

See [Tenant Vector and Ingestion Runtime](docs/tenant-ingestion-runtime.md) for
the durable job/vector contract, local PostgreSQL gate, and remaining production
boundary, and [Ingestion jobs API v1](docs/api/ingestion-jobs-v1.md) for the
authenticated enqueue/status contract, and
[Workflow Lifecycle API v1](docs/api/workflow-lifecycle-v1.md) for the governed
version/review/approval boundary, and
[EvidenceGapRequest API v1](docs/api/evidence-gap-requests-v1.md) for unresolved
documentary research intake, and [Search and EvidenceBundle API v1](docs/api/search-evidence-v1.md) for explicit retrieval modes, evidence classification, and conservative bundle construction.

See [Portable consumer contract kits](docs/integrations/consumer-contract-kits.md) for the OS Electoral and Content Agency provider-side manifests and limitations. See [Ephemeral staging and E2E architecture](docs/testing/ephemeral-staging-e2e-architecture.md) for deterministic test identity, fixtures, reset, role coverage, mocks, and the API-versus-browser decision rule.
