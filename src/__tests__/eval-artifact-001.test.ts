import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PRINCIPAL = "11111111-1111-4111-8111-111111111111";
const VERSION = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OBJECT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const SCAN = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const NOW = new Date("2026-07-21T12:00:00.000Z");
const BYTES = Buffer.from("Fuente municipal inmutable y verificable.", "utf8");
const DIGEST = createHash("sha256").update(BYTES).digest("hex");

const request: BeginArtifactInspectionInput = {
  tenantId: TENANT,
  principalId: PRINCIPAL,
  documentVersionId: VERSION,
  artifactSha256: DIGEST,
  originalFilename: "fuente.txt",
  mediaType: "text/plain",
  object: {
    storeName: "approved_store",
    objectNamespace: "tenant-private",
    objectKey: "documents/source-v1.txt",
    objectVersion: "generation-000001",
  },
};

class Repository implements ArtifactAcceptanceRepository {
  completed: CompleteArtifactInspectionInput[] = [];

  async beginInspection(input: BeginArtifactInspectionInput): Promise<ArtifactInspection> {
    return { ...input, artifactObjectId: OBJECT, inspectionGeneration: 1 };
  }

  async completeInspection(input: CompleteArtifactInspectionInput): Promise<ArtifactAcceptanceRecord> {
    this.completed.push(structuredClone(input));
    const accepted = input.outcome.verdict === "clean";
    return {
      artifactObjectId: OBJECT,
      artifactScanId: SCAN,
      documentVersionId: VERSION,
      status: accepted ? "accepted" : "rejected",
      verdict: input.outcome.verdict,
      failureCode: input.outcome.failureCode ?? null,
      acceptedUntil: input.outcome.acceptedUntil ?? null,
    };
  }

  async getAcceptedBinding(): Promise<null> {
    return null;
  }
}

const reader = (bytes: Buffer): ArtifactObjectReader => ({
  async readObject(reference) {
    return {
      reference,
      contentLength: bytes.byteLength,
      body: (async function* () { yield bytes; })(),
    };
  },
});

const service = (repository: Repository, bytes = BYTES, scannerCalls = { value: 0 }) =>
  new ArtifactAcceptanceService(repository, reader(bytes), {
    async scan() {
      scannerCalls.value += 1;
      return {
        verdict: "clean",
        engine: "clamav",
        engineVersion: "1.4.3",
        definitionsVersion: "20260721.1",
      };
    },
  }, {
    now: () => NOW,
    policy: {
      maxArtifactBytes: 1_024,
      malwareScanMaxAgeMs: 24 * 60 * 60 * 1_000,
      malwareScanTimeoutMs: 5_000,
    },
    objectReadTimeoutMs: 5_000,
  });

describe("EVAL-ARTIFACT-001", () => {
  it("accepts only exact immutable bytes with bounded structural and malware evidence", async () => {
    const repository = new Repository();
    const result = await service(repository).inspect(request);

    assert.equal(result.status, "accepted");
    const outcome = repository.completed[0]?.outcome;
    assert.equal(outcome?.contentSha256, DIGEST);
    assert.equal(outcome?.detectedMediaType, "text/plain");
    assert.equal(outcome?.structuralSignature, "utf8-text-v1");
    assert.equal(outcome?.scannerDefinitionsVersion, "20260721.1");
    assert.equal(outcome?.acceptedUntil, "2026-07-22T12:00:00.000Z");
  });

  it("rejects mutated bytes before invoking the malware scanner", async () => {
    const repository = new Repository();
    const scannerCalls = { value: 0 };
    const result = await service(
      repository,
      Buffer.from("mutated municipal bytes", "utf8"),
      scannerCalls
    ).inspect(request);

    assert.equal(result.status, "rejected");
    assert.equal(result.failureCode, "artifact_content_hash_mismatch");
    assert.equal(scannerCalls.value, 0);
  });

  it("keeps signed URLs, credentials, and object bodies out of persisted acceptance schema", async () => {
    const sql = await readFile(
      new URL("../../db/migrations/011_artifact_vector_runtime_hardening.sql", import.meta.url),
      "utf8"
    );
    assert.match(sql, /exact current clean scan/i);
    assert.match(sql, /artifact scan evidence is append-only/i);
    assert.doesNotMatch(sql, /^\s*(signed_url|credential|artifact_body|object_body|content)\s+/im);
  });
});
