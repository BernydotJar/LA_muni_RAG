import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const read = (path: string): Promise<string> =>
  readFile(new URL(`../../${path}`, import.meta.url), "utf8");

describe("EVAL-RESTORE-001 — isolated logical database restore", () => {
  it("requires service aliases and protected credential files instead of connection URLs", async () => {
    const script = await read("scripts/postgres-restore-drill.mjs");
    assert.match(script, /LA_MUNI_RESTORE_SOURCE_SERVICE/);
    assert.match(script, /LA_MUNI_RESTORE_TARGET_SERVICE/);
    assert.match(script, /PGSERVICEFILE/);
    assert.match(script, /must not be group\/world accessible/);
    assert.match(script, /non-symlink regular file/);
    assert.match(script, /must be owned by the restore process user/);
    assert.match(script, /source and target services must differ/);
    assert.match(script, /restore artifacts must remain outside the repository working tree/);
    assert.doesNotMatch(script, /DATABASE_URL/);
    assert.doesNotMatch(script, /shell:\s*true/);
  });

  it("uses a checksum-verified custom dump and transactional empty-target restore", async () => {
    const script = await read("scripts/postgres-restore-drill.mjs");
    assert.match(script, /--format=custom/);
    assert.match(script, /--no-owner/);
    assert.match(script, /--no-acl/);
    assert.match(script, /--list/);
    assert.match(script, /checksum changed before restore/);
    assert.match(script, /target must be empty/);
    assert.match(script, /--exit-on-error/);
    assert.match(script, /--single-transaction/);
    assert.match(script, /process\.umask\(0o077\)/);
    assert.match(script, /chmod\(dumpFile, 0o600\)/);
  });

  it("compares extensions, schema catalog, forced RLS and bounded table hashes", async () => {
    const [script, gate] = await Promise.all([
      read("scripts/postgres-restore-drill.mjs"),
      read("db/tests/restored_runtime_access_gate.sql"),
    ]);
    assert.match(script, /catalog_fingerprint_equal/);
    assert.match(script, /table_data_fingerprint_equal/);
    assert.match(script, /relrowsecurity/);
    assert.match(script, /relforcerowsecurity/);
    assert.match(script, /pg_get_constraintdef/);
    assert.match(script, /pg_get_functiondef/);
    assert.match(script, /LA_MUNI_RESTORE_DEEP_HASH_MAX_ROWS/);
    assert.match(script, /public\.digest\(to_jsonb\(t\)::text, 'sha256'\)/);
    assert.doesNotMatch(script, /SELECT md5\(/);
    assert.match(gate, /restored table % lost forced RLS/);
    assert.match(gate, /tenant B saw restored tenant A procedure cases/);
    assert.match(gate, /rolsuper OR rolbypassrls/);
  });

  it("keeps production, object-store, PITR, RPO/RTO and human review limitations explicit", async () => {
    const [script, runbook, evidence] = await Promise.all([
      read("scripts/postgres-restore-drill.mjs"),
      read("docs/operations/backup-restore.md"),
      read("docs/operations/restore-drill-2026-07-21.md"),
    ]);
    assert.match(script, /external_object_restore_verified:\s*false/);
    assert.match(script, /point_in_time_recovery_verified:\s*false/);
    assert.match(script, /production_rpo_rto_verified:\s*false/);
    assert.match(script, /human_review_completed:\s*false/);
    assert.match(runbook, /disposable logical database restore/i);
    assert.match(evidence, /not production recovery evidence/i);
    assert.match(evidence, /external object restore[^\n]*not tested/i);
  });

  it("records a reproducible safe receipt without committing recovered data", async () => {
    const evidence = await read("docs/operations/restore-drill-2026-07-21.md");
    assert.match(evidence, /restore-drill-20260721-004/);
    assert.match(evidence, /40053845292b75c35e1b21213e7b2f97b24b1ff5a60ff031d3f4a4fd20f6f923/);
    assert.match(evidence, /catalog fingerprint[^\n]*equal/i);
    assert.match(evidence, /table-data fingerprint[^\n]*equal/i);
    assert.match(evidence, /procedure_case_postgres_http_smoke_passed/);
    assert.doesNotMatch(evidence, /postgresql:\/\//);
    assert.doesNotMatch(evidence, /password=/i);
  });
});
