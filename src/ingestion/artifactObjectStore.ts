const STORE_NAME_PATTERN = /^[a-z][a-z0-9_-]{0,79}$/;
const OBJECT_VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/;
const URI_PREFIX_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//;
const CONTROL_CHARACTER_PATTERN = /[\x00-\x1f\x7f]/;

export const MAX_OBJECT_COORDINATE_BYTES = 1024;
export const MAX_OBJECT_READ_TIMEOUT_MS = 10 * 60 * 1000;

export interface ArtifactObjectReference {
  /** Logical adapter name selected by trusted server configuration. */
  storeName: string;
  /** Provider-neutral bucket/container/namespace identifier. */
  objectNamespace: string;
  /** Opaque object key. It must not be a URL or signed request. */
  objectKey: string;
  /** Exact immutable generation/version, never a mutable latest alias. */
  objectVersion: string;
}

export interface ImmutableArtifactObject {
  reference: ArtifactObjectReference;
  contentLength: number;
  body: AsyncIterable<Uint8Array>;
}

export interface ArtifactObjectReader {
  readObject(
    reference: ArtifactObjectReference,
    options: { signal: AbortSignal; maxBytes: number }
  ): Promise<ImmutableArtifactObject>;
}

export class ArtifactObjectStoreError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable = false,
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = "ArtifactObjectStoreError";
  }
}

const boundedOpaqueCoordinate = (value: unknown, maximum: number): value is string =>
  typeof value === "string" &&
  value.length >= 1 &&
  Buffer.byteLength(value, "utf8") <= maximum &&
  !CONTROL_CHARACTER_PATTERN.test(value) &&
  !URI_PREFIX_PATTERN.test(value);

export const assertArtifactObjectReference = (
  reference: ArtifactObjectReference
): ArtifactObjectReference => {
  if (
    !reference ||
    !STORE_NAME_PATTERN.test(reference.storeName) ||
    !boundedOpaqueCoordinate(reference.objectNamespace, 255) ||
    !boundedOpaqueCoordinate(reference.objectKey, MAX_OBJECT_COORDINATE_BYTES) ||
    !OBJECT_VERSION_PATTERN.test(reference.objectVersion)
  ) {
    throw new ArtifactObjectStoreError(
      "artifact_object_reference_invalid",
      "Immutable artifact object coordinates are invalid."
    );
  }
  return { ...reference };
};

const referencesEqual = (
  actual: ArtifactObjectReference,
  expected: ArtifactObjectReference
): boolean =>
  actual.storeName === expected.storeName &&
  actual.objectNamespace === expected.objectNamespace &&
  actual.objectKey === expected.objectKey &&
  actual.objectVersion === expected.objectVersion;

const timeoutError = (): ArtifactObjectStoreError => new ArtifactObjectStoreError(
  "artifact_object_read_timeout",
  "Immutable artifact object read exceeded its bounded deadline.",
  true
);

const raceWithAbort = async <T>(promise: Promise<T>, signal: AbortSignal): Promise<T> => {
  if (signal.aborted) throw timeoutError();
  return new Promise<T>((resolve, reject) => {
    const aborted = () => reject(timeoutError());
    signal.addEventListener("abort", aborted, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", aborted);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", aborted);
        reject(error);
      }
    );
  });
};

export interface BoundedObjectReadOptions {
  maxBytes: number;
  timeoutMs: number;
}

/**
 * Read one exact immutable generation with a hard returned-byte bound.
 * Provider adapters must also enforce maxBytes before buffering a response and
 * honor the AbortSignal so an underlying network request is actually stopped.
 */
export const readBoundedImmutableObject = async (
  reader: ArtifactObjectReader,
  reference: ArtifactObjectReference,
  options: BoundedObjectReadOptions
): Promise<Buffer> => {
  const expected = assertArtifactObjectReference(reference);
  if (
    !Number.isSafeInteger(options.maxBytes) ||
    options.maxBytes < 1 ||
    options.maxBytes > 1024 * 1024 * 1024 ||
    !Number.isSafeInteger(options.timeoutMs) ||
    options.timeoutMs < 1_000 ||
    options.timeoutMs > MAX_OBJECT_READ_TIMEOUT_MS
  ) {
    throw new ArtifactObjectStoreError(
      "artifact_object_read_policy_invalid",
      "Immutable artifact object read policy is invalid."
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  timer.unref?.();
  let iterator: AsyncIterator<Uint8Array> | undefined;
  try {
    let result: ImmutableArtifactObject;
    try {
      result = await raceWithAbort(
        reader.readObject(expected, { signal: controller.signal, maxBytes: options.maxBytes }),
        controller.signal
      );
    } catch (error) {
      if (error instanceof ArtifactObjectStoreError) throw error;
      throw new ArtifactObjectStoreError(
        "artifact_object_read_failed",
        "Immutable artifact object could not be read.",
        true,
        { cause: error }
      );
    }
    try {
      assertArtifactObjectReference(result.reference);
    } catch (error) {
      throw new ArtifactObjectStoreError(
        "artifact_object_identity_mismatch",
        "Object adapter returned a different immutable generation.",
        false,
        { cause: error }
      );
    }
    if (!referencesEqual(result.reference, expected)) {
      throw new ArtifactObjectStoreError(
        "artifact_object_identity_mismatch",
        "Object adapter returned a different immutable generation."
      );
    }
    if (
      !Number.isSafeInteger(result.contentLength) ||
      result.contentLength < 1 ||
      result.contentLength > options.maxBytes
    ) {
      throw new ArtifactObjectStoreError(
        "artifact_object_size_invalid",
        "Immutable artifact object length is unavailable or exceeds policy."
      );
    }
    if (!result.body || typeof result.body[Symbol.asyncIterator] !== "function") {
      throw new ArtifactObjectStoreError(
        "artifact_object_body_invalid",
        "Object adapter did not return a byte stream."
      );
    }

    iterator = result.body[Symbol.asyncIterator]();
    const chunks: Buffer[] = [];
    let total = 0;
    while (true) {
      const next = await raceWithAbort(Promise.resolve(iterator.next()), controller.signal);
      if (next.done) break;
      if (!(next.value instanceof Uint8Array)) {
        throw new ArtifactObjectStoreError(
          "artifact_object_body_invalid",
          "Object adapter returned a non-byte stream chunk."
        );
      }
      if (next.value.byteLength < 1 || total + next.value.byteLength > options.maxBytes) {
        throw new ArtifactObjectStoreError(
          "artifact_object_size_exceeded",
          "Immutable artifact object exceeded the configured byte limit."
        );
      }
      total += next.value.byteLength;
      chunks.push(Buffer.from(next.value));
    }
    if (total !== result.contentLength) {
      throw new ArtifactObjectStoreError(
        "artifact_object_length_mismatch",
        "Object adapter content length did not match the streamed bytes."
      );
    }
    return Buffer.concat(chunks, total);
  } finally {
    clearTimeout(timer);
    if (controller.signal.aborted === false && iterator?.return) {
      // A fully consumed iterator normally treats return as a no-op. On a
      // rejected read it gives an adapter the opportunity to close resources.
      try {
        await iterator.return();
      } catch {
        // Preserve the primary bounded-read result/error.
      }
    }
    controller.abort();
  }
};
