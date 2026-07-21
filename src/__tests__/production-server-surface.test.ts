import assert from "node:assert/strict";
import type { Server } from "node:http";
import { after, before, describe, it } from "node:test";
import { InMemoryIngestionApiPersistence } from "../api/v1/ingestionIndex.js";
import { createApiServer } from "../server.js";

describe("production server surface", () => {
  let server: Server;
  let baseUrl: string;
  let previousNodeEnv: string | undefined;

  before(async () => {
    previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const ingestionPersistence = new InMemoryIngestionApiPersistence();
    server = createApiServer({
      ingestionJobV1: {
        identityRepository: { authenticateByCredentialHash: async () => null },
        persistence: ingestionPersistence,
        authenticationFailureRecorder: ingestionPersistence,
        pipelineConfig: null,
      },
      v1CorsAllowedOrigins: ["https://trusted.example"],
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen({ host: "127.0.0.1", port: 0 }, () => {
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
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  });

  for (const path of [
    "/api/domain-pack",
    "/api/search?q=test",
    "/api/evidence?q=test",
    "/api/procedure?q=test",
    "/api/procedure-feedback",
    "/api/agent?q=test",
    "/api/answer?q=test",
    "/api/chat",
  ]) {
    it(`does not expose legacy route ${path}`, async () => {
      const response = await fetch(`${baseUrl}${path}`, {
        method: path === "/api/chat" ? "POST" : "GET",
        headers: { origin: "https://untrusted.example" },
        ...(path === "/api/chat"
          ? { body: JSON.stringify({ message: "test" }), headers: {
              origin: "https://untrusted.example",
              "content-type": "application/json",
            } }
          : {}),
      });

      assert.equal(response.status, 404);
      assert.equal(response.headers.get("access-control-allow-origin"), null);
      assert.deepEqual(await response.json(), {
        error: { code: "not_found", message: "Route not found" },
      });
    });
  }

  it("rejects legacy preflight without wildcard CORS", async () => {
    const response = await fetch(`${baseUrl}/api/search`, {
      method: "OPTIONS",
      headers: {
        origin: "https://untrusted.example",
        "access-control-request-method": "GET",
      },
    });

    assert.equal(response.status, 404);
    assert.equal(response.headers.get("access-control-allow-origin"), null);
  });

  it("keeps the authenticated ingestion route ahead of the legacy production gate", async () => {
    const requestId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const response = await fetch(`${baseUrl}/api/v1/ingestion-jobs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "production-surface-check-0001",
        "x-request-id": requestId,
      },
      body: "{malformed-before-auth",
    });
    const body = await response.json() as {
      tenant_id?: unknown;
      error?: { code?: unknown };
    };

    assert.equal(response.status, 401);
    assert.equal(response.headers.get("access-control-allow-origin"), null);
    assert.equal(body.tenant_id, null);
    assert.equal(body.error?.code, "unauthorized");
  });

  it("keeps the authenticated ClaimPack route ahead of the legacy production gate", async () => {
    const requestId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const response = await fetch(`${baseUrl}/api/v1/claim-packs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "production-claim-pack-check-0001",
        "x-request-id": requestId,
      },
      body: "{malformed-before-auth",
    });
    const body = await response.json() as {
      tenant_id?: unknown;
      error?: { code?: unknown };
    };

    assert.equal(response.status, 401);
    assert.equal(response.headers.get("access-control-allow-origin"), null);
    assert.equal(body.tenant_id, null);
    assert.equal(body.error?.code, "unauthorized");
  });

  it("advertises only exact-origin POST ClaimPack CORS", async () => {
    const trusted = await fetch(`${baseUrl}/api/v1/claim-packs`, {
      method: "OPTIONS",
      headers: { origin: "https://trusted.example" },
    });
    const untrusted = await fetch(`${baseUrl}/api/v1/claim-packs`, {
      method: "OPTIONS",
      headers: { origin: "https://untrusted.example" },
    });

    assert.equal(trusted.status, 204);
    assert.equal(trusted.headers.get("access-control-allow-origin"), "https://trusted.example");
    assert.equal(trusted.headers.get("access-control-allow-methods"), "POST, OPTIONS");
    assert.equal(untrusted.status, 204);
    assert.equal(untrusted.headers.get("access-control-allow-origin"), null);
  });

  it("advertises only exact-origin GET/POST ingestion CORS", async () => {
    const trusted = await fetch(`${baseUrl}/api/v1/ingestion-jobs`, {
      method: "OPTIONS",
      headers: { origin: "https://trusted.example" },
    });
    const untrusted = await fetch(`${baseUrl}/api/v1/ingestion-jobs`, {
      method: "OPTIONS",
      headers: { origin: "https://untrusted.example" },
    });

    assert.equal(trusted.status, 204);
    assert.equal(trusted.headers.get("access-control-allow-origin"), "https://trusted.example");
    assert.equal(trusted.headers.get("access-control-allow-methods"), "GET, POST, OPTIONS");
    assert.equal(untrusted.status, 204);
    assert.equal(untrusted.headers.get("access-control-allow-origin"), null);
  });

  it("keeps the intentionally public health endpoint available", async () => {
    const response = await fetch(`${baseUrl}/health`);
    const body = await response.json() as {
      status?: unknown;
      ingestionJobApi?: { enabled?: unknown; workerConfigured?: unknown };
      claimPackApi?: { enabled?: unknown; validitySeconds?: unknown };
    };

    assert.equal(response.status, 200);
    assert.equal(body.status, "ok");
    assert.equal(body.ingestionJobApi?.enabled, false);
    assert.equal(body.ingestionJobApi?.workerConfigured, false);
    assert.equal(body.claimPackApi?.enabled, true);
    assert.equal(body.claimPackApi?.validitySeconds, 86_400);
  });
});
