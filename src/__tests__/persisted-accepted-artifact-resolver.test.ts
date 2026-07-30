import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  type ArtifactAcceptanceRepository,
  type PersistedAcceptedArtifactBinding,
} from "../ingestion/artifactAcceptance.js";
import type { ArtifactObjectReader } from "../ingestion/artifactObjectStore.js";
import { PersistedAcceptedArtifactResolver } from "../ingestion/persistedAcceptedArtifactResolver.js";
import { AcceptedArtifactError, artifactSha256 } from "../ingestion/acceptedArtifact.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const VERSION_ID = "22222222-2222-4222-8222-222222222222";
const OBJECT_ID = "33333333-3333-4333-8333-333333333333";
const SCAN_ID = "44444444-4444-4444-8444-444444444444";
const CONTENT = Buffer.from("Persisted accepted municipal artifact.", "utf8");
const DIGEST = artifactSha256(CONTENT);

const request = {
  tenantId: TENANT_ID,
  documentVersionId: VERSION_ID,
  artifactSha256: DIGEST,
  artifactObjectId: OBJECT_ID,
  artifactScanId: SCAN_ID,
};

const binding: PersistedAcceptedArtifactBinding = {
  artifactObjectId: OBJECT_ID,
  artifactScanId: SCAN_ID,
  object: {
    storeName: "approved_store",
    objectNamespace: "tenant-private",
    objectKey: "documents/manual.txt",
    objectVersion: "generation-000001",
  },
  originalFilename: "manual.txt",
  mediaType: "text/plain",
  artifactSha256: DIGEST,
  safety: {
    verdict: "clean",
    contentSha256: DIGEST,
    byteLength: CONTENT.byteLength,
    detectedMediaType: "text/plain",
    structuralSignature: "utf8-text-v1",
    inspectedAt: "2026-07-20T01:00:00.000Z",
    scannerEngine: "clamav",
    scannerEngineVersion: "1.4.3",
    scannerDefinitionsVersion: "20260720.1",
  },
};

const repository = (result: PersistedAcceptedArtifactBinding | null): ArtifactAcceptanceRepository => ({
  async beginInspection() { throw new Error("not used"); },
  async completeInspection() { throw new Error("not used"); },
  async getAcceptedBinding(input) {
    assert.deepEqual(input, request);
    return result;
  },
});

const reader = (overrides: Partial<ArtifactObjectReader> = {}): ArtifactObjectReader => ({
  async readObject(reference) {
    return {
      reference,
      contentLength: CONTENT.byteLength,
      body: (async function* () { yield CONTENT; })(),
    };
  },
  ...overrides,
});

describe("persisted accepted artifact resolver", () => {
  it("returns private bytes only for the exact object and clean-scan ids", async () => {
    const resolver = new PersistedAcceptedArtifactResolver(repository(binding), reader(), {
      policy: {
        maxArtifactBytes: 1024,
        malwareScanMaxAgeMs: 86_400_000,
        malwareScanTimeoutMs: 5_000,
      },
      objectReadTimeoutMs: 5_000,
    });
    const artifact = await resolver.resolveAcceptedArtifact(request);
    assert.equal(artifact.artifactObjectId, OBJECT_ID);
    assert.equal(artifact.artifactScanId, SCAN_ID);
    assert.deepEqual(artifact.content, CONTENT);
    assert.notEqual(artifact.content, CONTENT);
    assert.equal(artifact.objectVersion, "generation-000001");
  });

  it("fails closed when the exact persisted acceptance is revoked or expired", async () => {
    const resolver = new PersistedAcceptedArtifactResolver(repository(null), reader(), {
      policy: {
        maxArtifactBytes: 1024,
        malwareScanMaxAgeMs: 86_400_000,
        malwareScanTimeoutMs: 5_000,
      },
      objectReadTimeoutMs: 5_000,
    });
    await assert.rejects(
      () => resolver.resolveAcceptedArtifact(request),
      (error) => error instanceof AcceptedArtifactError &&
        error.code === "artifact_acceptance_unavailable" && error.retryable
    );
  });

  it("maps adapter failures to safe codes without returning object coordinates", async () => {
    const resolver = new PersistedAcceptedArtifactResolver(repository(binding), reader({
      async readObject() {
        throw new Error("https://private.invalid/?secret=DO_NOT_LEAK");
      },
    }), {
      policy: {
        maxArtifactBytes: 1024,
        malwareScanMaxAgeMs: 86_400_000,
        malwareScanTimeoutMs: 5_000,
      },
      objectReadTimeoutMs: 5_000,
    });
    await assert.rejects(
      () => resolver.resolveAcceptedArtifact(request),
      (error) => error instanceof AcceptedArtifactError &&
        error.code === "artifact_object_read_failed" &&
        !error.message.includes("private.invalid") &&
        !error.message.includes("DO_NOT_LEAK")
    );
  });
});
