import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const readSource = (path: string): Promise<string> => readFile(path, "utf-8");

const readPublicSources = async (): Promise<string> => {
  const entries = await readdir("public", { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile()).map((entry) => join("public", entry.name));
  return (await Promise.all(files.map((file) => readSource(file)))).join("\n");
};

describe("procedure feedback backend security contract", () => {
  it("creates a constrained feedback table with retention and no request metadata", async () => {
    const migration = await readSource("db/migrations/002_procedure_feedback.sql");

    assert.match(migration, /CREATE TABLE IF NOT EXISTS agent\.procedure_feedback/);
    assert.match(migration, /is_external_reference BOOLEAN GENERATED ALWAYS AS/);
    assert.match(migration, /retention_until TIMESTAMPTZ NOT NULL DEFAULT \(now\(\) \+ interval '180 days'\)/);
    assert.match(migration, /procedure_feedback_retention_idx/);
    assert.doesNotMatch(migration, /ip_address/i);
    assert.doesNotMatch(migration, /user_agent/i);
    assert.doesNotMatch(migration, /authorization/i);
    assert.doesNotMatch(migration, /cookie/i);
  });

  it("uses parameterized SQL for feedback persistence", async () => {
    const repository = await readSource("src/procedureFeedback/repository.ts");

    assert.match(repository, /VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9, \$10\)/);
    assert.match(repository, /feedback_type = \$\$\{params\.length\}/);
    assert.match(repository, /workflow_id = \$\$\{params\.length\}/);
    assert.doesNotMatch(repository, /authorization/i);
    assert.doesNotMatch(repository, /user-agent/i);
  });

  it("uses a timing-safe Bearer token comparison and fails closed", async () => {
    const auth = await readSource("src/procedureFeedback/auth.ts");

    assert.match(auth, /timingSafeEqual/);
    assert.match(auth, /feedback_api_disabled/);
    assert.match(auth, /feedback_unauthorized/);
    assert.match(auth, /Authorization|authorization/);
    assert.doesNotMatch(auth, /actual === expected/);
  });

  it("does not expose the feedback API token in public assets", async () => {
    const publicSources = await readPublicSources();

    assert.doesNotMatch(publicSources, /PROCEDURE_FEEDBACK_API_TOKEN/);
    assert.doesNotMatch(publicSources, /Authorization:\s*Bearer/i);
    assert.doesNotMatch(publicSources, /procedure-feedback-token/i);
  });

  it("documents feedback as product signal rather than municipal evidence", async () => {
    const docs = await readSource("docs/procedure-feedback-backend-api.md");

    assert.match(docs, /product signal, not municipal evidence/);
    assert.match(docs, /external reference/);
    assert.match(docs, /official Antigua documents/);
    assert.match(docs, /does not store/i);
  });
});
