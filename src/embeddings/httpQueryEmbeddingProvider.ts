import {
  QueryEmbeddingError,
  assertQueryEmbeddingDimension,
  type QueryEmbeddingProvider,
} from "./queryEmbedding.js";

export interface QueryEmbeddingTransportResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type QueryEmbeddingTransport = (
  url: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
    signal?: AbortSignal;
  }
) => Promise<QueryEmbeddingTransportResponse>;

export interface HttpQueryEmbeddingProviderOptions {
  endpoint: string;
  apiKey: string;
  model: string;
  dimensions: number;
  providerName?: string;
  timeoutMs?: number;
  transport?: QueryEmbeddingTransport;
}

interface EmbeddingResponseShape {
  data?: Array<{
    embedding?: unknown;
  }>;
}

const defaultTransport: QueryEmbeddingTransport = async (url, init) => {
  if (typeof fetch !== "function") {
    throw new QueryEmbeddingError("query_embedding_transport_unavailable", "Fetch transport is unavailable.", false);
  }

  return fetch(url, init);
};

const parseEmbeddingResponse = (payload: unknown): number[] => {
  const response = payload as EmbeddingResponseShape;
  const embedding = response.data?.[0]?.embedding;

  if (!Array.isArray(embedding) || embedding.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
    throw new QueryEmbeddingError("query_embedding_invalid_response", "Embedding provider returned an invalid vector.", false);
  }

  return embedding;
};

export class HttpQueryEmbeddingProvider implements QueryEmbeddingProvider {
  readonly providerName: string;
  readonly model: string;
  readonly dimensions: number;

  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly transport: QueryEmbeddingTransport;

  constructor(options: HttpQueryEmbeddingProviderOptions) {
    this.providerName = options.providerName ?? "http";
    this.model = options.model;
    this.dimensions = options.dimensions;
    const timeoutMs = options.timeoutMs ?? 10_000;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 10 || timeoutMs > 120_000) {
      throw new QueryEmbeddingError(
        "query_embedding_timeout_policy_invalid",
        "Query embedding timeout must be an integer between 10 and 120000 milliseconds.",
        false
      );
    }
    this.endpoint = options.endpoint;
    this.apiKey = options.apiKey;
    this.timeoutMs = timeoutMs;
    this.transport = options.transport ?? defaultTransport;
  }

  async embedQuery(text: string): Promise<number[]> {
    let response: QueryEmbeddingTransportResponse;

    const controller = new AbortController();
    let timeout: NodeJS.Timeout | undefined;
    const timeoutFailure = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new QueryEmbeddingError(
          "query_embedding_request_timeout",
          "Query embedding request timed out.",
          true
        ));
      }, this.timeoutMs);
    });
    try {
      response = await Promise.race([
        this.transport(this.endpoint, {
          method: "POST",
          headers: {
            authorization: `Bearer ${this.apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: this.model,
            input: text,
          }),
          signal: controller.signal,
        }),
        timeoutFailure,
      ]);
    } catch (cause) {
      if (cause instanceof QueryEmbeddingError) throw cause;
      throw new QueryEmbeddingError("query_embedding_request_failed", "Query embedding request failed.", true, { cause });
    } finally {
      if (timeout) clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new QueryEmbeddingError(
        "query_embedding_provider_error",
        `Query embedding provider returned HTTP ${response.status}.`,
        response.status >= 500
      );
    }

    const vector = parseEmbeddingResponse(await response.json());
    assertQueryEmbeddingDimension(vector, this.dimensions);
    return vector;
  }
}
