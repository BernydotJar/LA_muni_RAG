import {
  AcceptedArtifactError,
  type AcceptedArtifact,
  type AcceptedArtifactRequest,
  type AcceptedArtifactResolver,
} from "./acceptedArtifact.js";
import type { ArtifactAcceptanceRepository } from "./artifactAcceptance.js";
import {
  ArtifactObjectStoreError,
  readBoundedImmutableObject,
  type ArtifactObjectReader,
} from "./artifactObjectStore.js";
import {
  loadArtifactSafetyPolicy,
  type ArtifactSafetyPolicy,
} from "../sources/artifactSafety.js";

const DEFAULT_OBJECT_READ_TIMEOUT_MS = 120_000;

export interface PersistedAcceptedArtifactResolverOptions {
  policy?: ArtifactSafetyPolicy;
  env?: NodeJS.ProcessEnv;
  objectReadTimeoutMs?: number;
}

/**
 * Resolve only the exact accepted object/scan pair already fenced onto a job.
 * The opaque object coordinate never enters the API response or job payload.
 */
export class PersistedAcceptedArtifactResolver implements AcceptedArtifactResolver {
  private readonly policy: ArtifactSafetyPolicy;
  private readonly objectReadTimeoutMs: number;

  constructor(
    private readonly repository: ArtifactAcceptanceRepository,
    private readonly objectReader: ArtifactObjectReader,
    options: PersistedAcceptedArtifactResolverOptions = {}
  ) {
    this.policy = options.policy ?? loadArtifactSafetyPolicy(options.env);
    this.objectReadTimeoutMs = options.objectReadTimeoutMs ?? DEFAULT_OBJECT_READ_TIMEOUT_MS;
    if (
      !Number.isSafeInteger(this.policy.maxArtifactBytes) ||
      this.policy.maxArtifactBytes < 1 ||
      this.policy.maxArtifactBytes > 1024 * 1024 * 1024 ||
      !Number.isSafeInteger(this.policy.malwareScanMaxAgeMs) ||
      this.policy.malwareScanMaxAgeMs < 1 ||
      !Number.isSafeInteger(this.policy.malwareScanTimeoutMs) ||
      this.policy.malwareScanTimeoutMs < 1_000
    ) {
      throw new AcceptedArtifactError(
        "artifact_safety_policy_invalid",
        "Accepted artifact safety policy is invalid."
      );
    }
  }

  async resolveAcceptedArtifact(request: AcceptedArtifactRequest): Promise<AcceptedArtifact> {
    const binding = await this.repository.getAcceptedBinding(request);
    if (!binding) {
      throw new AcceptedArtifactError(
        "artifact_acceptance_unavailable",
        "The leased artifact generation no longer has current clean acceptance evidence.",
        true
      );
    }
    let content: Buffer;
    try {
      content = await readBoundedImmutableObject(this.objectReader, binding.object, {
        maxBytes: this.policy.maxArtifactBytes,
        timeoutMs: this.objectReadTimeoutMs,
      });
    } catch (error) {
      const objectError = error instanceof ArtifactObjectStoreError ? error : null;
      throw new AcceptedArtifactError(
        objectError?.code ?? "artifact_object_read_failed",
        "Accepted artifact bytes could not be read from the immutable object generation.",
        objectError?.retryable ?? true,
        { cause: error }
      );
    }
    return {
      tenantId: request.tenantId,
      documentVersionId: request.documentVersionId,
      artifactSha256: request.artifactSha256,
      artifactObjectId: binding.artifactObjectId,
      artifactScanId: binding.artifactScanId,
      objectVersion: binding.object.objectVersion,
      originalFilename: binding.originalFilename,
      mediaType: binding.mediaType,
      content,
      safety: { ...binding.safety },
    };
  }
}
