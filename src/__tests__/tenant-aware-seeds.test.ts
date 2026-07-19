import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const BOOTSTRAP_TENANT = "00000000-0000-4000-8000-000000000001";

describe("tenant-aware database bootstrap", () => {
  it("sets a transaction-local tenant and writes ownership explicitly in every seed", async () => {
    for (const path of ["db/seeds/001_core_documents.sql", "db/seeds/002_document_versions.sql"]) {
      const seed = await readFile(path, "utf8");
      assert.match(seed, /SELECT set_config\(\s*'app\.tenant_id',[\s\S]*?true\s*\);/);
      assert.match(seed, new RegExp(BOOTSTRAP_TENANT));
      assert.match(seed, /INSERT INTO rag\.(?:documents|document_versions) \(\s*tenant_id,/);
      assert.doesNotMatch(seed, /set_config\([^;]*false\s*\)/);
    }
  });

  it("documents migration order and never embeds a PostgreSQL password", async () => {
    const [readme, setup] = await Promise.all([
      readFile("README.md", "utf8"),
      readFile("docs/postgres-setup.md", "utf8"),
    ]);

    for (const document of [readme, setup]) {
      const migration001 = document.indexOf("001_initial_rag_schema.sql");
      const migration002 = document.indexOf("002_procedure_feedback.sql");
      const migration003 = document.indexOf("003_identity_tenancy_rbac.sql");
      assert.ok(migration001 >= 0 && migration002 > migration001 && migration003 > migration002);
      assert.doesNotMatch(document, /Password:\s*(?!REDACTED|YOUR_PASSWORD)[^\n]+/i);
      assert.doesNotMatch(
        document,
        /postgresql:\/\/[^:\s]+:(?!(?:YOUR_PASSWORD|REDACTED)@)[^@\s]+@/i
      );
    }

    assert.match(setup, /non-owner runtime role/i);
    assert.match(setup, /not have `BYPASSRLS`/);
    assert.match(setup, /remains unproven/i);
  });
});
