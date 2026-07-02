export interface QueryEmbeddingProvider {
  readonly providerName: string;
  readonly model: string;
  readonly dimensions: number;
  embedQuery(text: string): Promise<number[]>;
}

export class QueryEmbeddingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable: boolean,
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = "QueryEmbeddingError";
  }
}

export const assertQueryEmbeddingDimension = (
  vector: number[],
  expectedDimension: number
): void => {
  if (vector.length !== expectedDimension) {
    throw new QueryEmbeddingError(
      "query_embedding_dimension_mismatch",
      `Expected query embedding dimension ${expectedDimension}, received ${vector.length}.`,
      false
    );
  }
};

export const embedQuery = async (
  provider: QueryEmbeddingProvider,
  query: string
): Promise<number[]> => {
  const vector = await provider.embedQuery(query);
  assertQueryEmbeddingDimension(vector, provider.dimensions);
  return vector;
};
