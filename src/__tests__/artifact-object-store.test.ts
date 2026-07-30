import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ArtifactObjectStoreError,
  assertArtifactObjectReference,
  readBoundedImmutableObject,
  type ArtifactObjectReader,
  type ArtifactObjectReference,
} from "../ingestion/artifactObjectStore.js";

const reference: ArtifactObjectReference = {
  storeName: "approved_store",
  objectNamespace: "tenant-a-private",
  objectKey: "documents/version-1/manual.txt",
  objectVersion: "generation-000001",
};

const reader = (
  content: Uint8Array[],
  overrides: Partial<Awaited<ReturnType<ArtifactObjectReader["readObject"]>>> = {}
): ArtifactObjectReader => ({
  async readObject() {
    return {
      reference,
      contentLength: content.reduce((total, chunk) => total + chunk.byteLength, 0),
      body: (async function* () {
        yield* content;
      })(),
      ...overrides,
    };
  },
});

const expectCode = async (operation: () => Promise<unknown>, code: string): Promise<void> => {
  await assert.rejects(operation, (error) =>
    error instanceof ArtifactObjectStoreError && error.code === code
  );
};

describe("provider-neutral immutable artifact object reads", () => {
  it("copies an exact versioned byte stream within the declared bound", async () => {
    const content = await readBoundedImmutableObject(
      reader([Buffer.from("municipal "), Buffer.from("procedure")]),
      reference,
      { maxBytes: 1024, timeoutMs: 5_000 }
    );
    assert.equal(content.toString("utf8"), "municipal procedure");
  });

  it("rejects URLs, mutable-looking version omissions, and unapproved store names", () => {
    assert.throws(() => assertArtifactObjectReference({
      ...reference,
      objectKey: "https://signed.example.test/object?credential=secret",
    }), /coordinates are invalid/i);
    assert.throws(() => assertArtifactObjectReference({ ...reference, objectVersion: "" }));
    assert.throws(() => assertArtifactObjectReference({ ...reference, storeName: "UPPER" }));
  });

  it("rejects adapter identity and declared-length drift", async () => {
    await expectCode(
      () => readBoundedImmutableObject(reader([Buffer.from("x")], {
        reference: { ...reference, objectVersion: "generation-000002" },
      }), reference, { maxBytes: 10, timeoutMs: 5_000 }),
      "artifact_object_identity_mismatch"
    );
    await expectCode(
      () => readBoundedImmutableObject(reader([Buffer.from("x")], {
        contentLength: 2,
      }), reference, { maxBytes: 10, timeoutMs: 5_000 }),
      "artifact_object_length_mismatch"
    );
  });

  it("cancels iteration when streamed bytes exceed policy", async () => {
    let finalized = false;
    const oversized: ArtifactObjectReader = {
      async readObject() {
        return {
          reference,
          contentLength: 3,
          body: (async function* () {
            try {
              yield Buffer.from("ab");
              yield Buffer.from("c");
            } finally {
              finalized = true;
            }
          })(),
        };
      },
    };
    await expectCode(
      () => readBoundedImmutableObject(oversized, reference, { maxBytes: 2, timeoutMs: 5_000 }),
      "artifact_object_size_invalid"
    );
    // The trusted adapter must enforce the advertised length before streaming.
    assert.equal(finalized, false);

    const dishonest: ArtifactObjectReader = {
      async readObject() {
        return {
          reference,
          contentLength: 2,
          body: (async function* () {
            try {
              yield Buffer.from("a");
              yield Buffer.from("bc");
            } finally {
              finalized = true;
            }
          })(),
        };
      },
    };
    finalized = false;
    await expectCode(
      () => readBoundedImmutableObject(dishonest, reference, { maxBytes: 2, timeoutMs: 5_000 }),
      "artifact_object_size_exceeded"
    );
    assert.equal(finalized, true);
  });

  it("rejects non-byte chunks without coercing attacker-controlled values", async () => {
    const invalid: ArtifactObjectReader = {
      async readObject() {
        return {
          reference,
          contentLength: 1,
          body: (async function* () {
            yield "x" as unknown as Uint8Array;
          })(),
        };
      },
    };
    await expectCode(
      () => readBoundedImmutableObject(invalid, reference, { maxBytes: 10, timeoutMs: 5_000 }),
      "artifact_object_body_invalid"
    );
  });
});
