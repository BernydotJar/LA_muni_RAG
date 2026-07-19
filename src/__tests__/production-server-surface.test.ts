import assert from "node:assert/strict";
import type { Server } from "node:http";
import { after, before, describe, it } from "node:test";
import { createApiServer } from "../server.js";

describe("production server surface", () => {
  let server: Server;
  let baseUrl: string;
  let previousNodeEnv: string | undefined;

  before(async () => {
    previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    server = createApiServer();
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

  it("keeps the intentionally public health endpoint available", async () => {
    const response = await fetch(`${baseUrl}/health`);
    const body = await response.json() as { status?: unknown };

    assert.equal(response.status, 200);
    assert.equal(body.status, "ok");
  });
});
