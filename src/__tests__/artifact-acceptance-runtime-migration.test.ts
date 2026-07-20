import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const migrationUrl = new URL("../../db/migrations/007_persisted_artifact_acceptance.sql", import.meta.url);

describe("persisted artifact acceptance migration", () => {
  it("creates forced-RLS object and append-only scan evidence without bodies or URLs", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    assert.match(sql, /CREATE TABLE rag\.artifact_objects/i);
    assert.match(sql, /CREATE TABLE rag\.artifact_scans/i);
    assert.match(sql, /ALTER TABLE rag\.artifact_objects FORCE ROW LEVEL SECURITY/i);
    assert.match(sql, /ALTER TABLE rag\.artifact_scans FORCE ROW LEVEL SECURITY/i);
    assert.match(sql, /object_key !~ '\^\[A-Za-z\]/i);
    assert.match(sql, /expected_sha256 BYTEA NOT NULL/i);
    assert.match(sql, /UNIQUE \(tenant_id, artifact_object_id, inspection_generation\)/i);
    assert.match(sql, /WHERE status = 'accepted'/i);
    assert.doesNotMatch(sql, /^\s*(signed_url|artifact_body|object_body|content)\s+/im);
  });

  it("adds exact object/scan fencing to processing jobs", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    assert.match(sql, /ADD COLUMN artifact_object_id UUID/i);
    assert.match(sql, /ADD COLUMN artifact_scan_id UUID/i);
    assert.match(sql, /ingestion_jobs_artifact_object_fk/i);
    assert.match(sql, /ingestion_jobs_artifact_scan_fk/i);
    assert.match(sql, /status = 'queued'[\s\S]*artifact_object_id IS NOT NULL[\s\S]*artifact_scan_id IS NOT NULL/i);
  });
});
