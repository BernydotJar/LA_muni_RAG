import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import http from "node:http";
import { createApiServer } from "../server.js";
import type {
  ProcedureFeedbackFilters,
  ProcedureFeedbackInput,
  ProcedureFeedbackListResult,
  ProcedureFeedbackRecord,
  ProcedureFeedbackRepository,
} from "../procedureFeedback/index.js";
import { InMemoryProcedureFeedbackRateLimiter } from "../procedureFeedback/rateLimit.js";
import { validateProcedureFeedbackInput } from "../procedureFeedback/validation.js";

class MemoryFeedbackRepository implements ProcedureFeedbackRepository {
  readonly items: ProcedureFeedbackRecord[] = [];

  async create(input: ProcedureFeedbackInput): Promise<ProcedureFeedbackRecord> {
    const item: ProcedureFeedbackRecord = {
      ...input,
      id: `feedback-${this.items.length + 1}`,
      isExternalReference: input.jurisdiction === "external reference",
      createdAt: "2026-07-10T12:00:00.000Z",
      retentionUntil: "2027-01-06T12:00:00.000Z",
    };
    this.items.unshift(item);
    return item;
  }

  async list(filters: ProcedureFeedbackFilters): Promise<ProcedureFeedbackListResult> {
    const filtered = this.items.filter((item) =>
      (!filters.feedbackType || item.feedbackType === filters.feedbackType) &&
      (!filters.workflowId || item.workflowId === filters.workflowId)
    );
    return { items: filtered.slice(0, filters.limit), total: filtered.length };
  }
}

const validPayload = (): ProcedureFeedbackInput => ({
  workflowId: "procedure:test",
  workflowTitle: "Flujo de cierre de obra",
  procedureType: "project_closure",
  jurisdiction: "Antigua Guatemala",
  confidence: "medium",
  query: "¿Qué falta para cerrar la obra?",
  stepNumber: "2",
  stepTitle: "Confirmar recepción física",
  feedbackType: "missing_document",
  comment: "Falta acta de recepción final.",
});

const requestJson = async (
  baseUrl: string,
  method: string,
  path: string,
  token?: string,
  body?: unknown
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Record<string, unknown> }> => {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(payload ? {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(payload),
        } : {}),
      },
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          body: JSON.parse(data) as Record<string, unknown>,
        });
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
};

describe("procedure feedback backend API", () => {
  const token = "test-procedure-feedback-token-123456";
  const repository = new MemoryFeedbackRepository();
  let server: Server;
  let baseUrl: string;

  before(async () => {
    server = createApiServer({
      evidenceDependencies: {},
      procedureFeedbackDependencies: {
        repository,
        apiToken: token,
        rateLimiter: new InMemoryProcedureFeedbackRateLimiter(2, 60_000),
      },
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen({ port: 0, host: "127.0.0.1" }, () => {
        server.off("error", reject);
        resolve();
      });
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Failed to bind test server");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  });

  it("fails closed when feedback API token is not configured", async () => {
    const disabledServer = createApiServer({
      evidenceDependencies: {},
      procedureFeedbackDependencies: {
        repository: new MemoryFeedbackRepository(),
        apiToken: undefined,
        rateLimiter: new InMemoryProcedureFeedbackRateLimiter(),
      },
    });
    await new Promise<void>((resolve) => disabledServer.listen({ port: 0, host: "127.0.0.1" }, resolve));
    const address = disabledServer.address();
    if (!address || typeof address === "string") throw new Error("Failed to bind disabled server");
    const response = await requestJson(`http://127.0.0.1:${address.port}`, "GET", "/api/procedure-feedback");
    await new Promise<void>((resolve) => disabledServer.close(() => resolve()));

    assert.equal(response.status, 503);
    assert.equal((response.body.error as Record<string, unknown>).code, "feedback_api_disabled");
  });

  it("rejects requests without a valid Bearer token", async () => {
    const response = await requestJson(baseUrl, "GET", "/api/procedure-feedback");
    assert.equal(response.status, 401);
    assert.equal((response.body.error as Record<string, unknown>).code, "feedback_unauthorized");
  });

  it("creates validated feedback and preserves external-reference classification", async () => {
    const response = await requestJson(baseUrl, "POST", "/api/procedure-feedback", token, {
      ...validPayload(),
      jurisdiction: "external reference",
    });

    assert.equal(response.status, 201);
    const item = response.body.item as Record<string, unknown>;
    assert.equal(item.workflowId, "procedure:test");
    assert.equal(item.isExternalReference, true);
    assert.equal(item.jurisdiction, "external reference");
  });

  it("lists persisted feedback with bounded filters", async () => {
    const response = await requestJson(
      baseUrl,
      "GET",
      "/api/procedure-feedback?limit=10&feedbackType=missing_document&workflowId=procedure%3Atest",
      token
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.total, 1);
    assert.ok(Array.isArray(response.body.items));
  });

  it("rejects unsupported payload values", async () => {
    const response = await requestJson(baseUrl, "POST", "/api/procedure-feedback", token, {
      ...validPayload(),
      jurisdiction: "Mixco official",
    });

    assert.equal(response.status, 400);
    assert.equal((response.body.error as Record<string, unknown>).code, "invalid_feedback_payload");
  });

  it("rate-limits repeated writes", async () => {
    const first = await requestJson(baseUrl, "POST", "/api/procedure-feedback", token, validPayload());
    const second = await requestJson(baseUrl, "POST", "/api/procedure-feedback", token, validPayload());

    assert.equal(first.status, 201);
    assert.equal(second.status, 429);
    assert.equal((second.body.error as Record<string, unknown>).code, "feedback_rate_limited");
  });

  it("allows authorization in CORS responses", async () => {
    const response = await requestJson(baseUrl, "GET", "/health");
    assert.match(String(response.headers["access-control-allow-headers"]), /authorization/);
  });

  it("normalizes Unicode and strips disallowed control characters", () => {
    const result = validateProcedureFeedbackInput({
      ...validPayload(),
      comment: "  Falta\u0001 acta de recepcio\u0301n.  ",
    });
    assert.equal(result.comment, "Falta acta de recepción.");
  });
});
