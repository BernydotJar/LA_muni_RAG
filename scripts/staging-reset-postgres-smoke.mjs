import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { closeDb } from "../dist/db.js";
import { createApiServer } from "../dist/server.js";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TOKEN = "staging-reset-manager-token-20260722-00000001";
const ORIGIN = "https://admin.example";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for staging reset smoke");

const server = createApiServer({
  legacyApiEnabled: false,
  v1CorsAllowedOrigins: [ORIGIN],
  catalogV1: { rateLimit: 100, rateWindowSeconds: 60 },
});
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen({ host: "127.0.0.1", port: 0 }, () => {
    server.off("error", reject);
    resolve();
  });
});
const address = server.address();
if (!address || typeof address === "string") throw new Error("staging reset smoke did not bind");
try {
  const response = await fetch(
    `http://127.0.0.1:${address.port}/api/v1/sources?tenant_id=${TENANT}&limit=100`,
    { headers: { authorization: `Bearer ${TOKEN}`, origin: ORIGIN, "x-request-id": randomUUID() } }
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.response_type, "source_catalog_page");
  assert.deepEqual(body.items, []);
  assert.equal(body.next_cursor, null);
  process.stdout.write(JSON.stringify({ status: "staging_reset_integrity_passed", source_count: 0 }) + "\n");
} finally {
  await new Promise((resolve) => server.close(resolve));
  await closeDb();
}
