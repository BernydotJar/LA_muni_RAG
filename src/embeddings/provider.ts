import type { EmbeddingProvider } from "./types.js";

export class DeterministicTestEmbeddingProvider implements EmbeddingProvider {
  readonly providerName = "deterministic-test";
  readonly model = "deterministic-test-v1";

  constructor(public readonly dimensions = 8) {}

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => {
      const vector = Array.from({ length: this.dimensions }, (_, index) => {
        let accumulator = index + 1;
        for (let position = index; position < text.length; position += this.dimensions) {
          accumulator = (accumulator * 31 + text.charCodeAt(position)) % 997;
        }
        return Number((accumulator / 997).toFixed(6));
      });
      return vector;
    });
  }
}
