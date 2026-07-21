import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const read = (path: string): Promise<string> => readFile(path, "utf8");

describe("operations readiness foundation", () => {
  it("keeps backend CI separate, least-privileged, bounded, and non-deploying", async () => {
    const workflow = await read(".github/workflows/ci.yml");

    assert.match(workflow, /^name: Backend CI$/m);
    assert.match(workflow, /^on:\n  push:\n  pull_request:$/m);
    assert.match(workflow, /^permissions:\n  contents: read$/m);
    assert.match(workflow, /^concurrency:\n  group: backend-ci-/m);
    assert.match(workflow, /^  cancel-in-progress: true$/m);
    assert.match(workflow, /^    timeout-minutes: 30$/m);
    assert.match(
      workflow,
      /uses: actions\/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd # v5/
    );
    assert.match(
      workflow,
      /uses: actions\/setup-node@a0853c24544627f65ddf259abe73b1d18a591444 # v5\n        with:\n          node-version: 24\.12\.0/
    );

    for (const command of [
      "npm ci",
      "npm run contracts:validate",
      "npm run source-inventory:validate",
      "npm audit --audit-level=high",
      "npm run domain:evaluate",
      "npm run eval:procedure",
      "npm run eval:os-integration",
      "npm run eval:content-integration",
      "npm run eval:conflict",
      "npm run eval:boundary",
      "npm run eval:corrupt",
      "npm run eval:tenant",
      "npm run eval:mixco",
      "npm run eval:water",
      "npm run typecheck",
      "npm run test:workflow-lifecycle",
      "npm test",
      "npm run build",
    ]) {
      assert.match(workflow, new RegExp(`run: ${command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    }

    assert.match(
      workflow,
      /pgvector\/pgvector:0\.8\.5-pg16-bookworm@sha256:1d533553fefe4f12e5d80c7b80622ba0c382abb5758856f52983d8789179f0fb/
    );
    assert.match(workflow, /db\/migrations\/005_tenant_ingestion_runtime\.sql/);
    assert.match(workflow, /db\/migrations\/006_ingestion_api_runtime\.sql/);
    assert.match(workflow, /db\/migrations\/007_persisted_artifact_acceptance\.sql/);
    assert.match(workflow, /db\/migrations\/008_claim_pack_api\.sql/);
    assert.match(workflow, /db\/migrations\/009_workflow_lifecycle\.sql/);
    assert.match(workflow, /db\/tests\/claim_pack_runtime_gate\.sql/);
    assert.match(workflow, /db\/tests\/tenant_ingestion_runtime_gate\.sql/);
    assert.match(workflow, /run: npm run smoke:tenant-ingestion/);
    assert.match(workflow, /run: npm run smoke:ingestion-api/);
    assert.match(workflow, /run: npm run smoke:claim-pack/);

    assert.doesNotMatch(workflow, /build:pages|configure-pages|upload-pages|deploy-pages/i);
    assert.doesNotMatch(workflow, /^\s*(?:pages|id-token|actions|checks): write$/m);
    assert.doesNotMatch(workflow, /^\s*environment:/m);
    assert.doesNotMatch(workflow, /\$\{\{\s*secrets\./);
  });

  it("keeps the named general-procedure hard eval executable and honestly documented", async () => {
    const [packageJson, evaluation] = await Promise.all([
      read("package.json"),
      read("docs/testing/eval-harness.md"),
    ]);

    assert.match(packageJson, /"eval:procedure": "node --import tsx --test src\/__tests__\/eval-procedure-001\.test\.ts"/);
    assert.match(evaluation, /## EVAL-PROCEDURE-001/);
    assert.match(evaluation, /recognized as procedural but remains `unknown`/);
    assert.match(evaluation, /three distinct sources support exactly one matching step each/);
    assert.match(evaluation, /passed_with_corpus_and_lifecycle_limitations/);
    assert.match(evaluation, /controlled synthetic fixtures/);
    assert.match(evaluation, /not an executable instruction/);
  });

  it("keeps the named OS Electoral provider eval executable and honestly bounded", async () => {
    const [packageJson, evaluation, openapi, smoke] = await Promise.all([
      read("package.json"),
      read("docs/testing/eval-harness.md"),
      read("contracts/openapi/v1/openapi.json"),
      read("scripts/procedure-query-postgres-smoke.mjs"),
    ]);

    assert.match(packageJson, /"eval:os-integration": "node --import tsx --test src\/__tests__\/eval-os-integration-001\.test\.ts"/);
    assert.match(evaluation, /## EVAL-OS-INTEGRATION-001/);
    assert.match(evaluation, /same internal compilation used by the workflow provider/);
    assert.match(evaluation, /passed_for_workflow_and_evidence_bundle_provider_with_assessment_and_external_consumer_limitations/);
    assert.match(evaluation, /No consumer contract test has run inside the OS Electoral repository/);
    assert.match(openapi, /claim_pack_evidence_bundle_procedure_workflow_and_ingestion_job_providers_implemented_with_limits/);
    assert.match(smoke, /evidenceBundleValidated: true/);
    assert.match(smoke, /requested_output: "evidence_bundle"/);
  });

  it("keeps the named Content Agency ClaimPack eval executable and bounded to evidence", async () => {
    const [packageJson, evaluation, openapi, smoke] = await Promise.all([
      read("package.json"),
      read("docs/testing/eval-harness.md"),
      read("contracts/openapi/v1/openapi.json"),
      read("scripts/claim-pack-postgres-smoke.mjs"),
    ]);

    assert.match(packageJson, /"eval:content-integration": "node --import tsx --test src\/__tests__\/eval-content-integration-001\.test\.ts"/);
    assert.match(evaluation, /## EVAL-CONTENT-INTEGRATION-001/);
    assert.match(evaluation, /claims, citations, paraphrase limits, disclaimer, validity bound, and source links/);
    assert.match(evaluation, /does not generate copy, assets, channels, publication tasks, or campaign strategy/);
    assert.match(openapi, /\/api\/v1\/claim-packs/);
    assert.match(smoke, /claim_pack_postgres_http_smoke_passed/);
    assert.match(smoke, /contentGenerated: false/);
  });

  it("keeps explicit version conflicts visible and review-required", async () => {
    const [packageJson, evaluation, mapper, conflictEval] = await Promise.all([
      read("package.json"),
      read("docs/testing/eval-harness.md"),
      read("src/api/v1/mapper.ts"),
      read("src/__tests__/eval-conflict-001.test.ts"),
    ]);

    assert.match(packageJson, /"eval:conflict": "node --import tsx --test src\/__tests__\/eval-conflict-001\.test\.ts"/);
    assert.match(evaluation, /## EVAL-CONFLICT-001/);
    assert.match(evaluation, /same document \+ same citation slot \+ distinct document versions \+ different cited text/);
    assert.match(mapper, /review_required: true/);
    assert.match(mapper, /ninguna versión puede promoverse silenciosamente/);
    assert.match(conflictEval, /does not create a conflict when versions contain the same cited text/);
    assert.match(conflictEval, /does not treat different excerpts from the same version as a version conflict/);
    assert.match(conflictEval, /does not join different documents into a false version conflict/);
  });

  it("keeps the named product-boundary hard eval executable and honestly documented", async () => {
    const [packageJson, evaluation] = await Promise.all([
      read("package.json"),
      read("docs/testing/eval-harness.md"),
    ]);

    assert.match(packageJson, /"eval:boundary": "node --import tsx --test src\/__tests__\/eval-boundary-001\.test\.ts"/);
    assert.match(evaluation, /## EVAL-BOUNDARY-001/);
    assert.match(evaluation, /rejected before the procedure compiler runs/);
    assert.match(evaluation, /names both downstream owners/);
    assert.match(evaluation, /does not retain the raw question, facts, or constraints/);
    assert.match(evaluation, /passed_for_current_provider_surface/);
    assert.match(evaluation, /Every future endpoint and external consumer/);
  });

  it("keeps the named corrupt-input and recovery hard eval executable and honestly bounded", async () => {
    const [packageJson, evaluation] = await Promise.all([
      read("package.json"),
      read("docs/testing/eval-harness.md"),
    ]);

    assert.match(packageJson, /"eval:corrupt": "node --import tsx --test src\/__tests__\/eval-corrupt-001\.test\.ts src\/__tests__\/ingestion-pdf\.test\.ts src\/__tests__\/ingestion-worker\.test\.ts src\/__tests__\/ingestion-job-service\.test\.ts"/);
    assert.match(evaluation, /## EVAL-CORRUPT-001/);
    assert.match(evaluation, /invalidated on failure/);
    assert.match(evaluation, /releases the processing reservation/);
    assert.match(evaluation, /never call completion/);
    assert.match(evaluation, /passed_for_current_replay_and_ingestion_failure_surfaces_with_storage_limitations/);
    assert.match(evaluation, /do not prove a deployed malware scanner/);
  });

  it("keeps the named tenant-isolation hard eval and PostgreSQL gate executable", async () => {
    const [packageJson, evaluation, workflow] = await Promise.all([
      read("package.json"),
      read("docs/testing/eval-harness.md"),
      read(".github/workflows/ci.yml"),
    ]);

    assert.match(packageJson, /"eval:tenant": "node --import tsx --test src\/__tests__\/eval-tenant-001\.test\.ts"/);
    assert.match(evaluation, /## EVAL-TENANT-001/);
    assert.match(evaluation, /same contract-valid `403 forbidden` shape/);
    assert.match(evaluation, /does not retain foreign-tenant facts/);
    assert.match(evaluation, /passed_for_current_provider_and_disposable_db_gate_with_topology_limitations/);
    assert.match(workflow, /db\/tests\/procedure_query_runtime_gate\.sql/);
    assert.match(workflow, /npm run smoke:postgres-api/);
    assert.match(workflow, /la_muni_rag_test/);
  });

  it("keeps the named Mixco hard eval executable and honestly documented", async () => {
    const [packageJson, evaluation] = await Promise.all([
      read("package.json"),
      read("docs/testing/eval-harness.md"),
    ]);

    assert.match(packageJson, /"eval:mixco": "node --import tsx --test src\/__tests__\/eval-mixco-001\.test\.ts"/);
    assert.match(evaluation, /## EVAL-MIXCO-001/);
    assert.match(evaluation, /official for Mixco but is classified `external_reference`\/`comparative`/);
    assert.match(evaluation, /official_for_target_jurisdiction=false/);
    assert.match(evaluation, /No define por sí sola el procedimiento oficial de Antigua Guatemala/);
    assert.match(evaluation, /passed_with_corpus_and_corroboration_limitations/);
    assert.match(evaluation, /controlled synthetic fixture/);
  });

  it("keeps the named water hard eval executable and honestly documented", async () => {
    const [packageJson, evaluation] = await Promise.all([
      read("package.json"),
      read("docs/testing/eval-harness.md"),
    ]);

    assert.match(packageJson, /"eval:water": "node --import tsx --test src\/__tests__\/eval-water-001\.test\.ts"/);
    assert.match(evaluation, /## EVAL-WATER-001/);
    assert.match(evaluation, /exactly 47 ordered research categories/);
    assert.match(evaluation, /Documento o regla pendiente de localizar y validar\./);
    assert.match(evaluation, /passed_with_corpus_and_runtime_limitations/);
    assert.match(evaluation, /does not prove that all Antigua Guatemala sources have been located/);
    assert.match(evaluation, /No evaluation result authorizes deployment/);
  });

  it("builds an explicit, multi-stage, non-root production container", async () => {
    const [dockerfile, dockerignore] = await Promise.all([read("Dockerfile"), read(".dockerignore")]);

    assert.match(dockerfile, /^ARG NODE_VERSION=24\.12\.0-bookworm-slim$/m);
    assert.equal(dockerfile.match(/^FROM /gm)?.length, 3);
    assert.match(dockerfile, /^FROM node:\$\{NODE_VERSION\} AS build$/m);
    assert.match(dockerfile, /^FROM node:\$\{NODE_VERSION\} AS production-dependencies$/m);
    assert.match(dockerfile, /^FROM node:\$\{NODE_VERSION\} AS runtime$/m);
    assert.match(dockerfile, /^RUN npm ci$/m);
    assert.match(dockerfile, /^RUN npm ci --omit=dev && npm cache clean --force$/m);
    assert.match(dockerfile, /COPY --from=build --chown=node:node \/app\/dist \.\/dist/);
    assert.match(dockerfile, /COPY --chown=node:node contracts\/schemas\/v1 \.\/contracts\/schemas\/v1/);
    assert.match(dockerfile, /COPY --chown=node:node contracts\/openapi\/v1 \.\/contracts\/openapi\/v1/);
    assert.match(dockerfile, /^ENV NODE_ENV=production \\/m);
    assert.match(dockerfile, /^USER node$/m);
    assert.match(dockerfile, /^EXPOSE 3000$/m);
    assert.match(dockerfile, /^HEALTHCHECK[\s\S]*?\/health/m);
    assert.match(dockerfile, /^CMD \["node", "dist\/server\.js"\]$/m);
    assert.ok(dockerfile.indexOf("USER node") < dockerfile.indexOf("CMD [\"node\", \"dist/server.js\"]"));

    assert.doesNotMatch(dockerfile, /COPY\s+\.\s+\./);
    assert.doesNotMatch(dockerfile, /DATABASE_URL\s*=|PROCEDURE_FEEDBACK_API_TOKEN\s*=/);
    assert.doesNotMatch(dockerignore, /^contracts$/m);
    assert.match(dockerignore, /^contracts\/examples$/m);
    for (const excluded of [".git", ".env", ".env.*", "node_modules", "data/raw", ".rag", "RTK.md"])
      assert.match(dockerignore, new RegExp(`^${excluded.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"));
  });

  it("documents present risks instead of crediting unfinished security controls", async () => {
    const threatModel = await read("docs/security/threat-model.md");

    for (const stride of ["Spoofing", "Tampering", "Repudiation", "Information disclosure", "Denial of service", "Elevation of privilege"])
      assert.match(threatModel, new RegExp(`\\b${stride}\\b`));

    assert.match(threatModel, /legacy `\/api\/search`/);
    assert.match(threatModel, /GitHub Pages is a public static demonstration/);
    assert.match(threatModel, /disposable PostgreSQL 16\.14\/pgvector 0\.8\.5 gate/);
    assert.match(threatModel, /not an image scan\/signature, staging test, production role attestation, load test, deployment, or external-consumer proof/);
    assert.match(threatModel, /No production backend infrastructure/);
    assert.match(threatModel, /authenticated ingestion enqueue\/status/);
    assert.match(threatModel, /worker is only a class and is not\s+deployed/);
    assert.match(threatModel, /internal campaign strategy/);
    assert.match(threatModel, /Context7 CLI resolved `\/nodejs\/node`/);
  });

  it("keeps privacy ownership, retention, DSAR, and electoral exclusions explicit", async () => {
    const privacy = await read("docs/security/privacy-review.md");

    assert.match(privacy, /Privacy\/Legal owner: pending human assignment/);
    assert.match(privacy, /not approved to ingest internal electoral\/campaign data/);
    assert.match(privacy, /`retention_until` defaults to 180 days/);
    assert.match(privacy, /no purge job is evidenced/);
    assert.match(privacy, /Data-subject request procedure \(design, not yet operated\)/);
    assert.match(privacy, /no published intake channel\/SLA/);
    assert.match(privacy, /No production privacy audit or data-subject request exercise has been performed/);
  });

  it("requires human-gated, forward-only deployment with smoke and observation", async () => {
    const deployment = await read("docs/operations/deployment.md");

    assert.match(deployment, /no backend deployment has been performed/i);
    assert.match(deployment, /A human release approval is mandatory/);
    assert.match(deployment, /Database migrations are forward-only/);
    assert.match(deployment, /Do not reverse schema changes destructively/);
    assert.match(deployment, /approved secret manager/);
    assert.match(deployment, /includes the canonical v1 JSON Schemas and OpenAPI document/);
    assert.match(deployment, /ephemeral development build, not a vulnerability scan/);
    assert.match(deployment, /authenticated, authorized v1 procedure query succeeds/);
    assert.match(deployment, /authorized ingestion enqueue/);
    assert.match(deployment, /workerConfigured: false/);
    assert.match(deployment, /cross-tenant request return non-leaking 403/);
    assert.match(deployment, /Progressive traffic and observation/);
    assert.match(deployment, /does not select a cloud or container platform/i);
    assert.match(deployment, /npx ctx7 docs \/docker\/docs/);
  });

  it("defines a reproducible backup and isolated restore without inventing objectives or drills", async () => {
    const backup = await read("docs/operations/backup-restore.md");

    assert.match(backup, /RPO \| maximum acceptable data loss by data class \| pending human decision/);
    assert.match(backup, /RTO \| maximum acceptable restoration time by service tier \| pending human decision/);
    assert.match(backup, /pg_dump \\/);
    assert.match(backup, /PGSERVICEFILE="\$LA_MUNI_PGSERVICE_FILE"/);
    assert.match(backup, /PGPASSFILE="\$LA_MUNI_PGPASS_FILE"/);
    assert.match(backup, /--dbname="service=la_muni_backup"/);
    assert.match(backup, /--format=custom/);
    assert.match(backup, /pg_restore \\/);
    assert.match(backup, /--dbname="service=la_muni_restore"/);
    assert.match(backup, /--single-transaction/);
    assert.match(backup, /Never test a restore over the active production database/);
    assert.match(backup, /Current drill evidence: none/);
    assert.match(backup, /npx ctx7 docs \/websites\/postgresql_current/);
    assert.doesNotMatch(backup, /LA_MUNI_(?:RESTORE_)?DATABASE_URL/);
  });

  it("keeps application rollback immutable and database recovery forward-only", async () => {
    const rollback = await read("docs/operations/rollback.md");

    assert.match(rollback, /previously verified immutable image/);
    assert.match(rollback, /does not mean reversing an applied migration destructively/);
    assert.match(rollback, /corrective forward migration/);
    assert.match(rollback, /Never guess which tag was “previous.”/);
    assert.match(rollback, /Do not.*run down-SQL/is);
    assert.match(rollback, /Current rehearsal evidence: none/);
  });

  it("defines severity, command, containment, evidence, communications, and learning", async () => {
    const incident = await read("docs/operations/incident-response.md");

    for (const invariant of [
      "SEV-1 Critical",
      "Incident Commander (IC)",
      "Containment playbooks",
      "Investigation and evidence",
      "Communications",
      "Recovery and validation",
      "Resolution and postmortem",
    ])
      assert.match(incident, new RegExp(invariant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

    assert.match(incident, /contact roster, paging, channels, and exercise pending/i);
    assert.match(incident, /Current exercise evidence: none/);
    assert.match(incident, /Do not put credentials, database URLs, full query\/case bodies/);
  });
});
