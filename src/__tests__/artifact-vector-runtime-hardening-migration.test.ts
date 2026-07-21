import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const migrationPath = new URL(
  "../../db/migrations/011_artifact_vector_runtime_hardening.sql",
  import.meta.url
);
const acceptancePath = new URL("../ingestion/artifactAcceptance.ts", import.meta.url);
const jobServicePath = new URL("../ingestion/ingestionJobService.ts", import.meta.url);

describe("artifact, lease, and vector runtime hardening migration", () => {
  it("rejects accepted state unless the exact current clean scan is bounded", async () => {
    const sql = await readFile(migrationPath, "utf8");

    assert.match(sql, /CREATE FUNCTION rag\.validate_artifact_acceptance_v1\(\)/i);
    assert.match(sql, /scan\.verdict IS DISTINCT FROM 'clean'/i);
    assert.match(sql, /scan\.inspection_generation IS DISTINCT FROM NEW\.inspection_generation/i);
    assert.match(sql, /scan\.content_sha256 IS DISTINCT FROM NEW\.expected_sha256/i);
    assert.match(sql, /NEW\.accepted_until <= scan\.inspected_at/i);
    assert.match(sql, /NEW\.accepted_until > scan\.inspected_at \+ interval '7 days'/i);
    assert.match(sql, /NEW\.accepted_until <= statement_timestamp\(\)/i);
    assert.match(sql, /CREATE TRIGGER artifact_objects_validate_acceptance_v1/i);
    assert.match(sql, /BEFORE INSERT OR UPDATE ON rag\.artifact_objects/i);
    assert.match(sql, /NEW\.object_key IS DISTINCT FROM OLD\.object_key/i);
    assert.match(sql, /NEW\.document_version_id IS DISTINCT FROM OLD\.document_version_id/i);
    assert.match(sql, /accepted artifact identity is immutable/i);
    assert.match(sql, /existing accepted artifact rows violate the exact clean-scan boundary/i);
  });

  it("rechecks the exact scan boundary during lookup, lease, and completion", async () => {
    const [acceptance, jobs] = await Promise.all([
      readFile(acceptancePath, "utf8"),
      readFile(jobServicePath, "utf8"),
    ]);

    assert.match(acceptance, /scan\.inspection_generation = object\.inspection_generation/);
    assert.match(acceptance, /scan\.content_sha256 = object\.expected_sha256/);
    assert.match(acceptance, /object\.accepted_until <= scan\.inspected_at \+ interval '7 days'/);
    assert.match(jobs, /scan\.inspection_generation = object\.inspection_generation/);
    assert.match(jobs, /scan\.content_sha256 = object\.expected_sha256/);
    assert.match(jobs, /object\.accepted_until <= scan\.inspected_at \+ interval '7 days'/);
    assert.match(jobs, /rag\.lock_valid_artifact_acceptance_v1/);
    assert.match(jobs, /acceptance\[0\]\?\.accepted !== true/);
    const migration = await readFile(migrationPath, "utf8");
    assert.match(migration, /CREATE FUNCTION rag\.lock_valid_artifact_acceptance_v1/);
    assert.match(migration, /SECURITY DEFINER/);
    assert.match(migration, /p_tenant_id IS DISTINCT FROM identity\.current_tenant_id\(\)/);
    assert.match(migration, /FOR SHARE OF object, scan/);
  });
});
