import { createHash } from "node:crypto";
import type { EmbeddingProvider } from "./types.js";

export const LOCAL_EVALUATION_EMBEDDING_PROVIDER = "local-eval-hashing";
export const LOCAL_EVALUATION_EMBEDDING_MODEL = "token-bigram-hash-1536-v1";
export const LOCAL_EVALUATION_EMBEDDING_DIMENSIONS = 1536;

const TOKEN_PATTERN = /\p{L}[\p{L}\p{N}_-]*|\p{N}+/gu;

const featuresFor = (text: string): string[] => {
  const normalized = text.normalize("NFKC").toLocaleLowerCase("es-GT");
  const tokens = normalized.match(TOKEN_PATTERN) ?? [];
  const features: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    features.push(`u:${token}`);
    const next = tokens[index + 1];
    if (next) features.push(`b:${token}\u0000${next}`);
  }
  if (features.length === 0 && normalized.trim()) features.push(`raw:${normalized.trim()}`);
  return features;
};

const vectorFor = (text: string, dimensions: number): number[] => {
  const values = Array.from({ length: dimensions }, () => 0);
  for (const feature of featuresFor(text)) {
    const digest = createHash("sha256").update(feature, "utf8").digest();
    const index = digest.readUInt32BE(0) % dimensions;
    const sign = (digest[4]! & 1) === 0 ? 1 : -1;
    const weight = 1 + (digest[5]! / 255);
    values[index] += sign * weight;
  }
  const norm = Math.sqrt(values.reduce((sum, value) => sum + (value * value), 0));
  if (norm === 0) return values;
  return values.map((value) => value / norm);
};

/**
 * Deterministic local-only lexical hashing for controlled ingestion and retrieval
 * evaluation. It is deliberately not a semantic model and must never be used to
 * claim productive embedding quality.
 */
export class LocalEvaluationEmbeddingProvider implements EmbeddingProvider {
  readonly providerName = LOCAL_EVALUATION_EMBEDDING_PROVIDER;
  readonly model = LOCAL_EVALUATION_EMBEDDING_MODEL;
  readonly dimensions = LOCAL_EVALUATION_EMBEDDING_DIMENSIONS;

  async embed(texts: string[]): Promise<number[][]> {
    if (!Array.isArray(texts) || texts.length < 1 || texts.length > 64) {
      throw new Error("Local evaluation embedding batches must contain 1 to 64 texts.");
    }
    return texts.map((text) => {
      if (typeof text !== "string" || !text.trim()) {
        throw new Error("Local evaluation embedding input must be non-empty text.");
      }
      return vectorFor(text, this.dimensions);
    });
  }
}
