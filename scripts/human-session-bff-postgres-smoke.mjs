import assert from "node:assert/strict";
import { closeDb } from "../dist/db.js";
import {
  DeterministicHumanIdentityProvider,
  DeterministicTestSecretProtector,
} from "../dist/humanSession/index.js";
import { createApiServer } from "../dist/server.js";

const PUBLIC_ORIGIN = "http://localhost:3000";
const ISSUER = "https://issuer.example";
const SUBJECT = "opaque-subject-a";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for the human session BFF smoke gate");
}
const provider = new DeterministicHumanIdentityProvider("approved-provider");
const server = createApiServer({
  legacyApiEnabled: false,
  humanSession: {
    enabled: true,
    approvedProvider: true,
    provider,
    protector: new DeterministicTestSecretProtector({ allowInsecureTestOnly: true }),
    publicOrigin: PUBLIC_ORIGIN,
    allowedReturnPaths: ["/"],
  },
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen({ host: "127.0.0.1", port: 0 }, () => {
    server.off("error", reject);
    resolve();
  });
});
const address = server.address();
if (!address || typeof address === "string") throw new Error("human session smoke server did not bind");
const baseUrl = `http://127.0.0.1:${address.port}`;

const setCookies = (response) => {
  const values = response.headers.getSetCookie?.();
  if (values?.length) return values;
  const combined = response.headers.get("set-cookie");
  return combined ? combined.split(/,(?=[^;,]+=)/).map((value) => value.trim()) : [];
};
const cookiePair = (response, name) => {
  const value = setCookies(response).find((entry) => entry.startsWith(`${name}=`));
  assert.ok(value, `missing ${name} cookie`);
  return value.split(";", 1)[0];
};

try {
  const login = await fetch(`${baseUrl}/auth/login`, { redirect: "manual" });
  assert.equal(login.status, 302);
  assert.equal(login.headers.get("cache-control"), "no-store");
  const authorizationUrl = new URL(login.headers.get("location"));
  const state = authorizationUrl.searchParams.get("state");
  assert.ok(state);
  assert.equal(authorizationUrl.searchParams.get("code_challenge_method"), "S256");
  const loginCookie = cookiePair(login, "la_muni_login");
  assert.match(setCookies(login).join("\n"), /HttpOnly/);
  assert.match(setCookies(login).join("\n"), /SameSite=Lax/);

  const code = provider.issueAuthorizationCode(state, {
    issuer: ISSUER,
    subject: SUBJECT,
    roles: ["platform_admin"],
    tenant_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  });
  const callback = await fetch(
    `${baseUrl}/auth/callback?state=${encodeURIComponent(state)}&code=${encodeURIComponent(code)}`,
    { redirect: "manual", headers: { cookie: loginCookie } }
  );
  assert.equal(callback.status, 303);
  assert.equal(callback.headers.get("location"), "/");
  const initialSessionCookie = cookiePair(callback, "la_muni_session");

  const bootstrap = await fetch(`${baseUrl}/auth/session`, {
    method: "POST",
    headers: {
      cookie: initialSessionCookie,
      origin: PUBLIC_ORIGIN,
      "x-session-bootstrap": "v1",
    },
  });
  assert.equal(bootstrap.status, 200);
  const session = await bootstrap.json();
  assert.deepEqual(session.roles, ["viewer"]);
  assert.equal(session.permissions.includes("platform:admin"), false);
  assert.equal(session.tenant_id, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  assert.match(session.csrf_token, /^[A-Za-z0-9_-]{43,172}$/);
  const rotatedSessionCookie = cookiePair(bootstrap, "la_muni_session");
  assert.notEqual(rotatedSessionCookie, initialSessionCookie);

  const oldSession = await fetch(`${baseUrl}/auth/session`, {
    method: "POST",
    headers: {
      cookie: initialSessionCookie,
      origin: PUBLIC_ORIGIN,
      "x-session-bootstrap": "v1",
    },
  });
  assert.equal(oldSession.status, 401);

  const csrfDenied = await fetch(`${baseUrl}/auth/logout`, {
    method: "POST",
    headers: {
      cookie: rotatedSessionCookie,
      origin: "https://evil.example",
      "x-csrf-token": session.csrf_token,
    },
  });
  assert.equal(csrfDenied.status, 403);

  const logout = await fetch(`${baseUrl}/auth/logout`, {
    method: "POST",
    headers: {
      cookie: rotatedSessionCookie,
      origin: PUBLIC_ORIGIN,
      "x-csrf-token": session.csrf_token,
    },
  });
  assert.equal(logout.status, 200);
  assert.deepEqual(await logout.json(), { logged_out: true });

  const revokedSession = await fetch(`${baseUrl}/auth/session`, {
    method: "POST",
    headers: {
      cookie: rotatedSessionCookie,
      origin: PUBLIC_ORIGIN,
      "x-session-bootstrap": "v1",
    },
  });
  assert.equal(revokedSession.status, 401);

  const stateReplay = await fetch(
    `${baseUrl}/auth/callback?state=${encodeURIComponent(state)}&code=${encodeURIComponent(code)}`,
    { redirect: "manual", headers: { cookie: loginCookie } }
  );
  assert.equal(stateReplay.status, 401);

  const transportArtifacts = JSON.stringify({
    stateReplayStatus: stateReplay.status,
    csrfDeniedStatus: csrfDenied.status,
    logoutStatus: logout.status,
  });
  for (const forbidden of [state, code, SUBJECT, ISSUER, "platform_admin"]) {
    assert.equal(transportArtifacts.includes(forbidden), false);
  }


  console.log(JSON.stringify({
    status: "human_session_bff_postgres_smoke_passed",
    providerKind: "deterministic_test_only",
    bearerAcceptedInBrowser: false,
    localMembershipRole: "viewer",
    providerRoleIgnored: true,
    stateReplayRejected: true,
    oldSessionRejectedAfterRotation: true,
    csrfDeniedCrossOrigin: true,
    revokedSessionRejected: true,
  }));
} finally {
  await new Promise((resolve) => server.close(() => resolve()));
  await closeDb();
}
