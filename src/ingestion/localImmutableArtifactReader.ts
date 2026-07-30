import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import {
  ArtifactObjectStoreError,
  assertArtifactObjectReference,
  type ArtifactObjectReader,
  type ArtifactObjectReference,
  type ImmutableArtifactObject,
} from "./artifactObjectStore.js";

export interface LocalImmutableArtifactBinding {
  reference: ArtifactObjectReference;
  filePath: string;
  expectedSha256: string;
  expectedByteLength: number;
}

const referenceKey = (reference: ArtifactObjectReference): string => JSON.stringify([
  reference.storeName,
  reference.objectNamespace,
  reference.objectKey,
  reference.objectVersion,
]);

const sha256 = (content: Buffer): string => createHash("sha256").update(content).digest("hex");

/** Local evidence harness adapter. Never use it as a production object store. */
export class LocalImmutableArtifactReader implements ArtifactObjectReader {
  private readonly bindings = new Map<string, LocalImmutableArtifactBinding>();
  private readonly root: string;

  constructor(root: string, bindings: LocalImmutableArtifactBinding[]) {
    if (!isAbsolute(root)) throw new Error("Local immutable artifact root must be absolute.");
    this.root = resolve(root);
    for (const binding of bindings) {
      assertArtifactObjectReference(binding.reference);
      if (!/^[0-9a-f]{64}$/.test(binding.expectedSha256)) throw new Error("Invalid local artifact digest.");
      if (!Number.isSafeInteger(binding.expectedByteLength) || binding.expectedByteLength < 1) {
        throw new Error("Invalid local artifact byte length.");
      }
      const key = referenceKey(binding.reference);
      if (this.bindings.has(key)) throw new Error("Duplicate local artifact reference.");
      this.bindings.set(key, { ...binding, reference: { ...binding.reference } });
    }
  }

  async readObject(
    reference: ArtifactObjectReference,
    options: { signal: AbortSignal; maxBytes: number }
  ): Promise<ImmutableArtifactObject> {
    assertArtifactObjectReference(reference);
    const binding = this.bindings.get(referenceKey(reference));
    if (!binding) throw new ArtifactObjectStoreError("artifact_object_not_found", "Local immutable artifact is not allowlisted.");
    if (options.signal.aborted) throw new ArtifactObjectStoreError("artifact_object_read_timeout", "Local immutable artifact read was aborted.", true);
    const candidate = await realpath(binding.filePath);
    const pathFromRoot = relative(this.root, candidate);
    if (pathFromRoot === "" || pathFromRoot.startsWith("..") || isAbsolute(pathFromRoot)) {
      throw new ArtifactObjectStoreError("artifact_object_path_invalid", "Local immutable artifact escaped its configured root.");
    }
    const content = await readFile(candidate);
    if (content.byteLength !== binding.expectedByteLength || content.byteLength > options.maxBytes) {
      throw new ArtifactObjectStoreError("artifact_object_size_invalid", "Local immutable artifact length does not match evidence.");
    }
    if (sha256(content) !== binding.expectedSha256) {
      throw new ArtifactObjectStoreError("artifact_object_digest_mismatch", "Local immutable artifact digest does not match evidence.");
    }
    return {
      reference: { ...binding.reference },
      contentLength: content.byteLength,
      body: (async function* (): AsyncIterable<Uint8Array> { yield content; })(),
    };
  }
}
