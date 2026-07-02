import { createHash } from "node:crypto";
import type { EmbeddingChunk, EmbeddingSource } from "./types.js";

export const sha256Hex = (value: string): string =>
  createHash("sha256").update(value, "utf-8").digest("hex");

export const buildChunkIdentityInput = (
  source: EmbeddingSource,
  contentSha256: string,
  chunkOrdinal: number
): string =>
  [
    source.documentKey,
    source.documentVersion,
    source.sectionPath.join("/"),
    source.sectionType,
    source.citationLabel ?? "",
    source.pageStart ?? "",
    source.pageEnd ?? "",
    source.articleNumber ?? "",
    contentSha256,
    chunkOrdinal,
  ].join("|");

export const buildChunkId = (
  source: EmbeddingSource,
  contentSha256: string,
  chunkOrdinal: number
): string => sha256Hex(buildChunkIdentityInput(source, contentSha256, chunkOrdinal));

export const sameChunkIdentity = (left: EmbeddingChunk, right: EmbeddingChunk): boolean =>
  left.chunkId === right.chunkId && left.contentSha256 === right.contentSha256;
