import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const migrationPath = "db/migrations/003_identity_tenancy_rbac.sql";
const migration = await readFile(migrationPath, "utf8");
const initialMigration = await readFile("db/migrations/001_initial_rag_schema.sql", "utf8");

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const tenantOwnedTables = [
  "rag.municipalities",
  "rag.documents",
  "rag.document_versions",
  "rag.document_sections",
  "rag.section_embeddings",
  "rag.ingestion_jobs",
  "agent.conversations",
  "agent.messages",
  "agent.runs",
  "agent.retrieval_events",
  "agent.retrieval_results",
  "agent.answer_citations",
  "agent.procedure_feedback",
  "audit.events",
] as const;

describe("identity and tenant RLS migration", () => {
  it("is transactional and creates no PostgreSQL managed role", () => {
    assert.match(migration, /^BEGIN;/m);
    assert.match(migration, /^COMMIT;$/m);
    assert.doesNotMatch(migration, /\bCREATE\s+ROLE\b/i);
    assert.doesNotMatch(migration, /\bALTER\s+ROLE\b/i);
  });

  it("defines the exact ten application roles", () => {
    const roleBlock = migration.match(/CREATE TYPE identity\.role_name AS ENUM \(([\s\S]*?)\);/);
    assert.ok(roleBlock?.[1]);
    const roles = [...roleBlock[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
    assert.deepEqual(roles, [
      "platform_admin",
      "tenant_admin",
      "document_manager",
      "researcher",
      "procedure_author",
      "procedure_reviewer",
      "procedure_approver",
      "case_operator",
      "viewer",
      "integration_client",
    ]);
  });

  it("creates tenant-bound identity tables without plaintext credential storage", () => {
    for (const table of ["tenants", "principals", "memberships", "api_credentials"]) {
      assert.match(migration, new RegExp(`CREATE TABLE identity\\.${table} \\(`));
    }
    assert.match(migration, /secret_sha256 BYTEA NOT NULL UNIQUE CHECK \(octet_length\(secret_sha256\) = 32\)/);
    assert.match(migration, /FOREIGN KEY \(principal_id, tenant_id\)[\s\S]*?REFERENCES identity\.principals\(id, tenant_id\)/);
    assert.doesNotMatch(migration, /\b(api_token|bearer_token|raw_secret|plaintext_secret|secret_plaintext)\b/i);
  });

  it("uses a fixed-search-path SECURITY DEFINER digest lookup and revokes public execution", () => {
    const functionBlock = migration.match(
      /CREATE FUNCTION identity\.authenticate_api_credential\(p_secret_sha256 BYTEA\)([\s\S]*?)\$function\$;/
    );
    assert.ok(functionBlock?.[1]);
    assert.match(functionBlock[1], /SECURITY DEFINER/);
    assert.match(functionBlock[1], /SET search_path = pg_catalog, identity/);
    assert.match(functionBlock[1], /credential\.secret_sha256 = p_secret_sha256/);
    assert.match(functionBlock[1], /credential\.revoked_at IS NULL/);
    assert.match(functionBlock[1], /credential\.expires_at IS NULL OR credential\.expires_at > statement_timestamp\(\)/);
    assert.doesNotMatch(functionBlock[1], /current_setting\('app\.tenant_id'/);
    assert.match(
      migration,
      /REVOKE ALL ON FUNCTION identity\.authenticate_api_credential\(BYTEA\) FROM PUBLIC;/
    );
  });

  it("fails closed when the transaction-local tenant setting is missing or malformed", () => {
    const functionBlock = migration.match(
      /CREATE FUNCTION identity\.current_tenant_id\(\)([\s\S]*?)\$function\$;/
    );
    assert.ok(functionBlock?.[1]);
    assert.match(functionBlock[1], /current_setting\('app\.tenant_id', true\)/);
    assert.match(functionBlock[1], /tenant_setting IS NULL/);
    assert.match(functionBlock[1], /RETURN NULL;/);
    assert.match(functionBlock[1], /SET search_path = pg_catalog, identity/);
    assert.doesNotMatch(functionBlock[1], /current_user|session_user/i);
  });

  it("backfills one explicit bootstrap tenant before enforcing NOT NULL", () => {
    const bootstrapId = "00000000-0000-4000-8000-000000000001";
    assert.match(migration, new RegExp(`INSERT INTO identity\\.tenants[\\s\\S]*?${bootstrapId}`));
    assert.match(migration, /'legacy-bootstrap'/);
    assert.match(migration, /"requires_reassignment_review":true/);

    for (const table of tenantOwnedTables) {
      const escaped = escapeRegex(table);
      const addAt = migration.search(new RegExp(`ALTER TABLE ${escaped} ADD COLUMN tenant_id UUID;`));
      const notNullAt = migration.search(
        new RegExp(`ALTER TABLE ${escaped} ALTER COLUMN tenant_id SET NOT NULL;`)
      );
      assert.ok(addAt >= 0, `${table} must add a top-level tenant_id`);
      assert.ok(notNullAt > addAt, `${table} must enforce tenant_id after backfill`);
      const between = migration.slice(addAt, notNullAt);
      assert.match(between, /UPDATE /, `${table} must be backfilled explicitly`);
    }
  });

  it("enables and forces RLS with read/write tenant predicates on every owned table", () => {
    for (const table of tenantOwnedTables) {
      const escaped = escapeRegex(table);
      assert.match(
        migration,
        new RegExp(`ALTER TABLE ${escaped} ENABLE ROW LEVEL SECURITY;`),
        `${table} must enable RLS`
      );
      assert.match(
        migration,
        new RegExp(`ALTER TABLE ${escaped} FORCE ROW LEVEL SECURITY;`),
        `${table} must force RLS for owners`
      );
      const policy = migration.match(
        new RegExp(
          `CREATE POLICY [a-z_]+ ON ${escaped}\\s+FOR ALL USING \\(tenant_id = identity\\.current_tenant_id\\(\\)\\)\\s+WITH CHECK \\(tenant_id = identity\\.current_tenant_id\\(\\)\\);`
        )
      );
      assert.ok(policy, `${table} must use the same tenant predicate for reads and writes`);
    }
  });

  it("keeps authentication bootstrap tables private and tenant-filtered without FORCE", () => {
    for (const table of ["tenants", "principals", "memberships", "api_credentials"]) {
      assert.match(migration, new RegExp(`ALTER TABLE identity\\.${table} ENABLE ROW LEVEL SECURITY;`));
      assert.match(migration, new RegExp(`CREATE POLICY ${table}_tenant_isolation ON identity\\.${table}`));
      assert.doesNotMatch(migration, new RegExp(`ALTER TABLE identity\\.${table} FORCE ROW LEVEL SECURITY;`));
    }
    assert.match(migration, /REVOKE ALL ON ALL TABLES IN SCHEMA identity FROM PUBLIC;/);
  });

  it("enforces same-tenant parent-child relationships and tenant-leading indexes", () => {
    assert.match(
      migration,
      /FOREIGN KEY \(document_id, tenant_id\)[\s\S]*?REFERENCES rag\.documents\(id, tenant_id\)/
    );
    assert.match(
      migration,
      /FOREIGN KEY \(document_version_id, tenant_id\)[\s\S]*?REFERENCES rag\.document_versions\(id, tenant_id\)/
    );
    assert.match(
      migration,
      /FOREIGN KEY \(conversation_id, tenant_id\)[\s\S]*?REFERENCES agent\.conversations\(id, tenant_id\)/
    );
    assert.match(
      migration,
      /FOREIGN KEY \(retrieval_event_id, tenant_id\)[\s\S]*?REFERENCES agent\.retrieval_events\(id, tenant_id\)/
    );
    assert.match(migration, /CREATE INDEX documents_tenant_status_idx ON rag\.documents \(tenant_id,/);
    assert.match(migration, /CREATE INDEX audit_events_tenant_idx ON audit\.events \(tenant_id,/);
  });

  it("replaces deterministic global uniqueness with tenant-scoped identities", () => {
    assert.match(migration, /DROP CONSTRAINT municipalities_slug_key/);
    assert.match(
      migration,
      /municipalities_tenant_slug_key UNIQUE \(tenant_id, slug\)/
    );
    assert.match(
      migration,
      /DROP CONSTRAINT document_versions_content_sha256_key/
    );
    assert.match(
      migration,
      /document_versions_tenant_content_sha256_key[\s\S]*?UNIQUE \(tenant_id, content_sha256\)/
    );
    assert.match(
      migration,
      /document_versions_tenant_document_version_key[\s\S]*?UNIQUE \(tenant_id, document_id, version_label\)/
    );
  });

  it("conditionally hardens the standalone vector table without weakening policy", () => {
    assert.match(migration, /to_regclass\('rag\.embedding_vectors'\) IS NOT NULL/);
    assert.match(migration, /ALTER TABLE rag\.embedding_vectors ALTER COLUMN tenant_id SET NOT NULL/);
    assert.match(migration, /ALTER TABLE rag\.embedding_vectors DROP CONSTRAINT embedding_vectors_pkey/);
    assert.match(
      migration,
      /ALTER TABLE rag\.embedding_vectors ADD CONSTRAINT embedding_vectors_pkey PRIMARY KEY \(tenant_id, chunk_id\)/
    );
    assert.match(migration, /ALTER TABLE rag\.embedding_vectors FORCE ROW LEVEL SECURITY/);
    assert.match(
      migration,
      /CREATE POLICY embedding_vectors_tenant_isolation[\s\S]*?USING \(tenant_id = identity\.current_tenant_id\(\)\)[\s\S]*?WITH CHECK \(tenant_id = identity\.current_tenant_id\(\)\)/
    );
  });

  it("constrains audit ownership and event text at the database boundary", () => {
    assert.match(migration, /ALTER TABLE audit\.events ADD COLUMN tenant_id UUID;/);
    assert.match(migration, /audit_events_event_type_safe_chk CHECK/);
    assert.match(migration, /event_type !~ '\[\[:cntrl:\]\]'/);
    assert.match(initialMigration, /outcome TEXT NOT NULL CHECK \(outcome IN \('success', 'error', 'blocked'\)\)/);
  });
});
