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
      "npm run typecheck",
      "npm test",
      "npm run build",
    ]) {
      assert.match(workflow, new RegExp(`run: ${command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    }

    assert.doesNotMatch(workflow, /build:pages|configure-pages|upload-pages|deploy-pages/i);
    assert.doesNotMatch(workflow, /^\s*(?:pages|id-token|actions|checks): write$/m);
    assert.doesNotMatch(workflow, /^\s*environment:/m);
    assert.doesNotMatch(workflow, /\$\{\{\s*secrets\./);
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
    assert.match(threatModel, /identity, tenancy, RBAC, RLS, and sanitized-audit foundation is committed/);
    assert.match(threatModel, /HTTP enforcement and proof against a real migrated PostgreSQL instance remain in progress/);
    assert.match(threatModel, /No production backend infrastructure/);
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
