import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const read = (path: string): Promise<string> => readFile(path, "utf8");

describe("authenticated ingestion API and worker documentation", () => {
  it("defines the callable boundary without claiming upload, storage, scanner, worker deployment, or DMP access", async () => {
    const [spec, api, runbook] = await Promise.all([
      read("specs/057-authenticated-ingestion-api-worker.md"),
      read("docs/api/ingestion-jobs-v1.md"),
      read("docs/data/ingestion-runbook.md"),
    ]);

    assert.match(spec, /POST \/api\/v1\/ingestion-jobs/);
    assert.match(spec, /GET  \/api\/v1\/ingestion-jobs\/\{job_id\}/);
    assert.match(spec, /does not upload or acquire files/);
    assert.match(spec, /does not.*implement object storage or a malware scanner/is);
    assert.match(spec, /does not.*start a worker process/is);
    assert.match(spec, /DMP remains\s+`acquired`/);
    assert.match(spec, /controlledArtifactsRead: 0/);

    assert.match(api, /document:ingest/);
    assert.match(api, /not an upload or scanner endpoint/);
    assert.match(api, /workerConfigured: false/);
    assert.match(api, /does not include the artifact digest/);
    assert.match(api, /lease token/);
    assert.match(runbook, /job request/);
    assert.match(runbook, /no DMP bytes were read/);
  });

  it("keeps server-owned policy, immutable scan binding, and production residuals explicit", async () => {
    const [spec, runtime, threat, deployment] = await Promise.all([
      read("specs/057-authenticated-ingestion-api-worker.md"),
      read("docs/tenant-ingestion-runtime.md"),
      read("docs/security/threat-model.md"),
      read("docs/operations/deployment.md"),
    ]);

    assert.match(spec, /Clients cannot select extractor/);
    assert.match(spec, /immutable object generation\/version/);
    assert.match(spec, /rehashes them again after\s+extraction/);
    assert.match(runtime, /no\s+filesystem, URL, or object-storage default/);
    assert.match(runtime, /attempt-wide deadline\/cancellation/);
    assert.match(threat, /worker is only a class and is not\s+deployed/);
    assert.match(deployment, /human release approval is mandatory/i);
    assert.match(deployment, /does not process queued jobs/);
  });
});
