import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("EVAL-JOB-LEASE-001", () => {
  it("claims one eligible job with SKIP LOCKED and a fresh digest-only fencing token", async () => {
    const service = await readFile(
      new URL("../ingestion/ingestionJobService.ts", import.meta.url),
      "utf8"
    );
    assert.match(service, /FOR UPDATE OF job SKIP LOCKED/);
    assert.match(service, /attempt_count = job\.attempt_count \+ 1/);
    assert.match(service, /lease_token_sha256 = decode\(\$3, 'hex'\)/);
    assert.match(service, /lease_expires_at > statement_timestamp\(\)/);
    assert.match(service, /artifact_object_id = candidate\.artifact_object_id/);
    assert.match(service, /artifact_scan_id = candidate\.artifact_scan_id/);
    assert.doesNotMatch(service, /lease_token\s*=\s*\$3/);
  });

  it("fences stale workers from heartbeat, completion, and failure mutation", async () => {
    const service = await readFile(
      new URL("../ingestion/ingestionJobService.ts", import.meta.url),
      "utf8"
    );
    const tokenAndExpiry = /lease_token_sha256 = decode\([^\n]+\)[\s\S]{0,240}lease_expires_at > statement_timestamp\(\)/g;
    const guardedMutations = service.match(tokenAndExpiry) ?? [];
    assert.ok(guardedMutations.length >= 4, `expected at least four fenced mutations, found ${guardedMutations.length}`);
    assert.match(service, /Math\.min\(MAX_RETRY_DELAY_SECONDS, 30 \* \(2 \*\*/);
    assert.match(service, /attemptCount < job\.maxAttempts/);
  });

  it("retains a production-shaped concurrency, crash-recovery, rollback, and stale-token gate", async () => {
    const smoke = await readFile(
      new URL("../../scripts/tenant-ingestion-postgres-smoke.mjs", import.meta.url),
      "utf8"
    );
    assert.match(smoke, /Promise\.all\(Array\.from\(\{ length: 50 \}/);
    assert.match(smoke, /uniqueConcurrentLeases/);
    assert.match(smoke, /staleLeaseFenced: true/);
    assert.match(smoke, /rollbackVectorCount: 0/);
    assert.match(smoke, /replacementDeletedStaleChunks/);
  });
});
