import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import {
  ArtifactAcceptanceService,
  type ArtifactAcceptanceRecord,
  type ArtifactAcceptanceRepository,
  type ArtifactInspection,
  type BeginArtifactInspectionInput,
  type CompleteArtifactInspectionInput,
} from "../ingestion/artifactAcceptance.js";
import type { ArtifactObjectReader } from "../ingestion/artifactObjectStore.js";
import type { MalwareScanner } from "../sources/artifactSafety.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const PRINCIPAL_ID = "22222222-2222-4222-8222-222222222222";
const VERSION_ID = "33333333-3333-4333-8333-333333333333";
const OBJECT_ID = "44444444-4444-4444-8444-444444444444";
const SCAN_ID = "55555555-5555-4555-8555-555555555555";
const NOW = new Date("2026-07-20T01:00:00.000Z");
const CONTENT = Buffer.from("Procedimiento municipal verificado.", "utf8");
const DIGEST = "9982e7f190462dc4698c0df5cee5b816d4b2fd3a55aa465d2e562e61d7193b4a";

const input = (): BeginArtifactInspectionInput => ({
  tenantId: TENANT_ID,
  principalId: PRINCIPAL_ID,
  documentVersionId: VERSION_ID,
  artifactSha256: DIGEST,
  originalFilename: "manual.txt",
  mediaType: "text/plain",
  object: {
    storeName: "approved_store",
    objectNamespace: "tenant-a-private",
    objectKey: "documents/manual.txt",
    objectVersion: "generation-000001",
  },
});

class StubRepository implements ArtifactAcceptanceRepository {
  completed: CompleteArtifactInspectionInput[] = [];

  async beginInspection(value: BeginArtifactInspectionInput): Promise<ArtifactInspection> {
    return {
      ...value,
      artifactObjectId: OBJECT_ID,
      inspectionGeneration: 1,
    };
  }

  async completeInspection(value: CompleteArtifactInspectionInput): Promise<ArtifactAcceptanceRecord> {
    this.completed.push(structuredClone(value));
    return {
      artifactObjectId: OBJECT_ID,
      artifactScanId: SCAN_ID,
      documentVersionId: VERSION_ID,
      status: value.outcome.verdict === "clean" ? "accepted" : "rejected",
      verdict: value.outcome.verdict,
      failureCode: value.outcome.failureCode ?? null,
      acceptedUntil: value.outcome.acceptedUntil ?? null,
    };
  }

  async getAcceptedBinding(): Promise<null> {
    return null;
  }
}

const objectReader = (content = CONTENT): ArtifactObjectReader => ({
  async readObject(reference) {
    return {
      reference,
      contentLength: content.byteLength,
      body: (async function* () { yield content; })(),
    };
  },
});

const service = (
  repository: StubRepository,
  scanner: MalwareScanner,
  reader: ArtifactObjectReader = objectReader()
) => new ArtifactAcceptanceService(repository, reader, scanner, {
  now: () => NOW,
  policy: {
    maxArtifactBytes: 1024,
    malwareScanMaxAgeMs: 24 * 60 * 60 * 1000,
    malwareScanTimeoutMs: 5_000,
  },
  objectReadTimeoutMs: 5_000,
});

describe("persisted artifact acceptance service", () => {
  it("scans a private snapshot and records bounded clean evidence", async () => {
    const repository = new StubRepository();
    let scannedPath = "";
    const result = await service(repository, {
      async scan(path) {
        scannedPath = path;
        assert.deepEqual(await readFile(path), CONTENT);
        return {
          verdict: "clean",
          engine: "clamav",
          engineVersion: "1.4.3",
          definitionsVersion: "20260720.1",
        };
      },
    }).inspect(input());

    assert.equal(result.status, "accepted");
    assert.match(scannedPath, /la-muni-artifact-scan-/);
    const outcome = repository.completed[0]?.outcome;
    assert.equal(outcome?.contentSha256, DIGEST);
    assert.equal(outcome?.structuralSignature, "utf8-text-v1");
    assert.equal(outcome?.acceptedUntil, "2026-07-21T01:00:00.000Z");
    await assert.rejects(() => readFile(scannedPath), /ENOENT/);
  });

  it("persists an infected verdict without accepting the object", async () => {
    const repository = new StubRepository();
    const result = await service(repository, {
      async scan() {
        return {
          verdict: "infected",
          engine: "clamav",
          engineVersion: "1.4.3",
          definitionsVersion: "20260720.1",
          signature: "Synthetic-Test-Signature",
          failureCode: "malware_detected",
        };
      },
    }).inspect(input());
    assert.equal(result.status, "rejected");
    assert.equal(result.failureCode, "malware_detected");
    assert.equal(repository.completed[0]?.outcome.malwareSignature, "Synthetic-Test-Signature");
    assert.equal(repository.completed[0]?.outcome.acceptedUntil, undefined);
  });

  it("never invokes the scanner when immutable bytes do not match the registry digest", async () => {
    const repository = new StubRepository();
    let scans = 0;
    const result = await service(repository, {
      async scan() {
        scans += 1;
        throw new Error("must not run");
      },
    }, objectReader(Buffer.from("different artifact", "utf8"))).inspect(input());
    assert.equal(result.status, "rejected");
    assert.equal(result.failureCode, "artifact_content_hash_mismatch");
    assert.equal(scans, 0);
  });

  it("fails closed when a clean scanner omits its definitions version", async () => {
    const repository = new StubRepository();
    const result = await service(repository, {
      async scan() {
        return { verdict: "clean", engine: "clamav", engineVersion: "1.4.3" };
      },
    }).inspect(input());
    assert.equal(result.status, "rejected");
    assert.equal(result.failureCode, "malware_definitions_unavailable");
    assert.equal(repository.completed[0]?.outcome.verdict, "error");
  });

  it("records a safe object-store failure without leaking adapter details", async () => {
    const repository = new StubRepository();
    const result = await service(repository, {
      async scan() { throw new Error("must not run"); },
    }, {
      async readObject() {
        throw new Error("https://signed.invalid/?credential=SECRET");
      },
    }).inspect(input());
    assert.equal(result.failureCode, "artifact_object_read_failed");
    assert.doesNotMatch(JSON.stringify(repository.completed), /signed|credential|SECRET/i);
  });
});
