import { sameChunkIdentity } from "./chunkIdentity.js";
import type { EmbeddingRepository, EmbeddingVectorRecord } from "./types.js";

export class InMemoryEmbeddingRepository implements EmbeddingRepository {
  private readonly records = new Map<string, EmbeddingVectorRecord>();

  async upsert(record: EmbeddingVectorRecord): Promise<"inserted" | "updated" | "unchanged"> {
    const existing = this.records.get(record.chunk.chunkId);
    if (!existing) {
      this.records.set(record.chunk.chunkId, record);
      return "inserted";
    }

    const unchanged =
      sameChunkIdentity(existing.chunk, record.chunk) &&
      existing.embeddingModel === record.embeddingModel &&
      existing.embeddingProvider === record.embeddingProvider &&
      existing.embeddingDimension === record.embeddingDimension &&
      JSON.stringify(existing.embedding) === JSON.stringify(record.embedding);

    if (unchanged) return "unchanged";

    this.records.set(record.chunk.chunkId, record);
    return "updated";
  }

  async get(chunkId: string): Promise<EmbeddingVectorRecord | null> {
    return this.records.get(chunkId) ?? null;
  }

  async list(): Promise<EmbeddingVectorRecord[]> {
    return Array.from(this.records.values());
  }
}
