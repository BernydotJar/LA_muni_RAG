import "dotenv/config";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import http from "node:http";

// ---------------------------------------------------------------------------
// Skip the entire file if DATABASE_URL is not set — these tests hit the real
// database through the actual server handler.
// ---------------------------------------------------------------------------

if (!process.env.DATABASE_URL) {
  console.log("⏭  Skipping server integration tests (DATABASE_URL not set)");
  describe("server (integration — SKIPPED)", () => {
    it.skip("requires DATABASE_URL", () => {});
  });
} else {
  const { createApiServer } = await import("../server.js");
  const { closeDb } = await import("../db.js");

  // ---------------------------------------------------------------------------
  // Test helpers
  // ---------------------------------------------------------------------------

  let server: Server;
  let baseUrl: string;

  const get = async (path: string): Promise<{ status: number; body: Record<string, unknown> }> => {
    return new Promise((resolve, reject) => {
      http
        .get(`${baseUrl}${path}`, (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              resolve({
                status: res.statusCode ?? 0,
                body: JSON.parse(data) as Record<string, unknown>,
              });
            } catch {
              reject(new Error(`Invalid JSON: ${data}`));
            }
          });
        })
        .on("error", reject);
    });
  };

  const getRaw = async (path: string): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> => {
    return new Promise((resolve, reject) => {
      http
        .get(`${baseUrl}${path}`, (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            resolve({
              status: res.statusCode ?? 0,
              headers: res.headers,
              body: data,
            });
          });
        })
        .on("error", reject);
    });
  };

  const post = async (path: string, body: unknown): Promise<{ status: number; body: Record<string, unknown> }> => {
    const payload = JSON.stringify(body);
    return new Promise((resolve, reject) => {
      const req = http.request(`${baseUrl}${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(payload),
        },
      }, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({
              status: res.statusCode ?? 0,
              body: JSON.parse(data) as Record<string, unknown>,
            });
          } catch {
            reject(new Error(`Invalid JSON: ${data}`));
          }
        });
      });
      req.on("error", reject);
      req.write(payload);
      req.end();
    });
  };

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  describe("server (integration)", () => {
    before(async () => {
      server = createApiServer();
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen({ port: 0, host: "127.0.0.1" }, () => {
          server.off("error", reject);
          resolve();
        });
      });
      const addr = server.address();
      if (!addr || typeof addr === "string") throw new Error("Failed to bind");
      baseUrl = `http://127.0.0.1:${addr.port}`;
    });

    after(async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
      await closeDb();
    });

    // -----------------------------------------------------------------------
    // Health
    // -----------------------------------------------------------------------

    it("GET /health returns 200", async () => {
      const { status, body } = await get("/health");
      assert.equal(status, 200);
      assert.equal(body.status, "ok");
      assert.equal(body.service, "la-muni-rag-api");
    });

    it("GET /health exposes sanitized vector runtime status", async () => {
      const { status, body } = await get("/health");
      assert.equal(status, 200);
      assert.ok("vectorRuntime" in body);

      const vectorRuntime = body.vectorRuntime as Record<string, unknown>;
      assert.ok(["enabled", "disabled", "degraded"].includes(vectorRuntime.state as string));
      assert.ok(Array.isArray(vectorRuntime.reasons));
      assert.equal(typeof vectorRuntime.queryEmbeddingProviderConfigured, "boolean");
      assert.equal(typeof vectorRuntime.vectorRepositoryConfigured, "boolean");

      const serialized = JSON.stringify(vectorRuntime);
      assert.ok(!serialized.includes("DATABASE_URL"));
      assert.ok(!serialized.includes("postgresql://"));
      assert.ok(!serialized.includes("authorization"));
      assert.ok(!serialized.includes("apiKey"));
      assert.ok(!serialized.includes("endpoint"));
    });

    // -----------------------------------------------------------------------
    // Search
    // -----------------------------------------------------------------------

    it("GET /api/search returns valid structure", async () => {
      const { status, body } = await get("/api/search?mode=keyword&q=test&limit=2");
      assert.equal(status, 200);
      assert.equal(body.mode, "keyword");
      assert.equal(body.query, "test");
      assert.ok("resultCount" in body);
      assert.ok(Array.isArray(body.results));
    });

    // -----------------------------------------------------------------------
    // Evidence
    // -----------------------------------------------------------------------

    it("GET /api/evidence returns sourceType in items", async () => {
      const { status, body } = await get("/api/evidence?mode=keyword&q=test&limit=2");
      assert.equal(status, 200);
      assert.ok("answerStatus" in body);
      assert.ok(Array.isArray(body.evidence));
      const evidence = body.evidence as Array<Record<string, unknown>>;
      for (const item of evidence) {
        assert.ok("sourceType" in item, "evidence item must have sourceType");
        assert.ok(typeof item.sourceType === "string");
      }
    });

    // -----------------------------------------------------------------------
    // Agent
    // -----------------------------------------------------------------------

    it("GET /api/agent returns valid AgentResponse", async () => {
      const { status, body } = await get("/api/agent?mode=keyword&q=test&limit=2");
      assert.equal(status, 200);
      assert.ok("responseLabel" in body);
      assert.ok("confidence" in body);
      assert.ok("evidenceSummary" in body);
      assert.ok(Array.isArray(body.evidence));
      assert.ok("context" in body);

      const ctx = body.context as Record<string, unknown>;
      assert.ok("retrievalMode" in ctx);
      assert.ok("evidenceCount" in ctx);
      assert.ok("sourceTypes" in ctx);
      assert.ok("suggestedAction" in ctx);
    });

    // -----------------------------------------------------------------------
    // Deterministic Answer
    // -----------------------------------------------------------------------

    it("GET /api/answer returns deterministic answer structure", async () => {
      const { status, body } = await get("/api/answer?mode=phrase&q=CNPAG&limit=2");
      assert.equal(status, 200);
      assert.equal(body.query, "CNPAG");
      assert.equal(body.mode, "phrase");
      assert.ok("answerStatus" in body);
      assert.ok("answerLabel" in body);
      assert.ok(typeof body.answer === "string");
      assert.ok(Array.isArray(body.citations));
      assert.ok(Array.isArray(body.evidence));
    });

    it("GET /api/answer reports not_found without citations when no evidence exists", async () => {
      const { status, body } = await get("/api/answer?mode=keyword&q=zzzinexistente123&limit=2");
      assert.equal(status, 200);
      assert.equal(body.answerStatus, "not_found");
      assert.equal(body.answerLabel, "not_found");
      assert.deepEqual(body.citations, []);
      assert.deepEqual(body.evidence, []);
    });

    // -----------------------------------------------------------------------
    // Chat
    // -----------------------------------------------------------------------

    it("POST /api/chat returns valid ChatResponse", async () => {
      const { status, body } = await post("/api/chat", { message: "test", limit: 2 });
      assert.equal(status, 200);
      assert.equal(body.role, "assistant");
      assert.ok(typeof body.content === "string");
      assert.ok(Array.isArray(body.citations));
      assert.ok("meta" in body);

      const meta = body.meta as Record<string, unknown>;
      assert.ok("responseLabel" in meta);
      assert.ok("confidence" in meta);
      assert.ok("evidenceCount" in meta);
    });

    it("POST /api/chat works with phrase mode", async () => {
      const { status, body } = await post("/api/chat", { message: "CNPAG", mode: "phrase", limit: 2 });
      assert.equal(status, 200);
      assert.equal(body.role, "assistant");
      assert.ok(Array.isArray(body.citations));
      const meta = body.meta as Record<string, unknown>;
      assert.ok("responseLabel" in meta);
    });

    it("POST /api/chat with missing message returns 400", async () => {
      const { status, body } = await post("/api/chat", {});
      assert.equal(status, 400);
      const error = body.error as Record<string, unknown>;
      assert.equal(error.code, "missing_message");
    });

    // -----------------------------------------------------------------------
    // Static files
    // -----------------------------------------------------------------------

    it("GET / serves index.html", async () => {
      const { status, headers, body } = await getRaw("/");
      assert.equal(status, 200);
      assert.ok(headers["content-type"]?.includes("text/html"));
      assert.ok(body.includes("LA Muni RAG"));
    });

    it("GET /widget.js serves the widget", async () => {
      const { status, headers, body } = await getRaw("/widget.js");
      assert.equal(status, 200);
      assert.ok(headers["content-type"]?.includes("javascript"));
      assert.ok(body.includes("MuniChatWidget"));
    });

    // -----------------------------------------------------------------------
    // CORS
    // -----------------------------------------------------------------------

    it("responses include CORS headers", async () => {
      const { headers } = await getRaw("/health");
      assert.equal(headers["access-control-allow-origin"], "*");
    });

    // -----------------------------------------------------------------------
    // Error handling
    // -----------------------------------------------------------------------

    it("missing q param returns 400", async () => {
      const { status, body } = await get("/api/search?mode=keyword");
      assert.equal(status, 400);
      const error = body.error as Record<string, unknown>;
      assert.equal(error.code, "missing_query_param");
    });

    it("invalid mode returns 400", async () => {
      const { status, body } = await get("/api/evidence?mode=bad&q=test");
      assert.equal(status, 400);
      const error = body.error as Record<string, unknown>;
      assert.equal(error.code, "invalid_mode");
    });

    it("unknown route returns 404", async () => {
      const { status, body } = await get("/api/nonexistent");
      assert.equal(status, 404);
      const error = body.error as Record<string, unknown>;
      assert.equal(error.code, "not_found");
    });
  });
}
