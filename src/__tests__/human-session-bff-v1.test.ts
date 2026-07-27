import assert from "node:assert/strict";
import type { Server } from "node:http";
import { afterEach, describe, it } from "node:test";
import { createApiServer } from "../server.js";
import {
  createHumanSessionBffDependencies,
  DeterministicHumanIdentityProvider,
  DeterministicTestSecretProtector,
  InMemoryHumanSessionRepository,
  sha256Hex,
  type CreateHumanSessionInput,
  type HumanSessionAuditInput,
} from "../humanSession/index.js";
import { authenticateBearer, hashBearerCredential } from "../security/index.js";

const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";
const PRINCIPAL_A = "33333333-3333-4333-8333-333333333333";
const PRINCIPAL_B = "44444444-4444-4444-8444-444444444444";
const HUMAN_SUBJECT_A = "55555555-5555-4555-8555-555555555555";
const HUMAN_SUBJECT_B = "66666666-6666-4666-8666-666666666666";
const ISSUER = "https://issuer.test.invalid";
const SUBJECT = "opaque-human-subject-001";
const PUBLIC_ORIGIN = "http://localhost:3000";

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) => new Promise<void>((resolve) => server.close(() => resolve()))
    )
  );
});

const deterministicOpaque = (() => {
  let sequence = 0;
  return (bytes: number): string => {
    sequence += 1;
    const value = Buffer.alloc(bytes, sequence % 251);
    value.writeUInt32BE(sequence, 0);
    return value.toString("base64url");
  };
})();

const deterministicUuid = (() => {
  let sequence = 0;
  return (): string => {
    sequence += 1;
    return `90000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
  };
})();

interface Harness {
  server: Server;
  baseUrl: string;
  provider: DeterministicHumanIdentityProvider;
  repository: InMemoryHumanSessionRepository;
  now: { value: Date };
  sessionCookieName: string;
  loginCookieName: string;
}

const membershipSeed = (tenantId = TENANT_A, principalId = PRINCIPAL_A, humanSubjectId = HUMAN_SUBJECT_A) => ({
  providerId: "local-test-provider",
  issuerSha256: sha256Hex(ISSUER),
  subjectSha256: sha256Hex(SUBJECT),
  membership: {
    humanSubjectId,
    tenantId,
    principalId,
    roles: ["viewer"] as const,
  },
});

const startHarness = async (options: {
  seeds?: ReturnType<typeof membershipSeed>[];
  enabled?: boolean;
  publicOrigin?: string;
  repository?: InMemoryHumanSessionRepository;
} = {}): Promise<Harness> => {
  const now = { value: new Date("2026-07-27T12:00:00.000Z") };
  const provider = new DeterministicHumanIdentityProvider();
  const repository = options.repository ?? new InMemoryHumanSessionRepository(
    options.seeds ?? [membershipSeed()],
    deterministicUuid
  );
  const configuredOrigin = options.publicOrigin ?? PUBLIC_ORIGIN;
  const secureCookies = new URL(configuredOrigin).protocol === "https:";
  const sessionCookieName = secureCookies ? "__Host-la_muni_session" : "la_muni_session";
  const loginCookieName = secureCookies ? "__Host-la_muni_login" : "la_muni_login";
  const server = createApiServer({
    humanSession: options.enabled === false
      ? { enabled: false }
      : {
          enabled: true,
          approvedProvider: true,
          provider,
          repository,
          protector: new DeterministicTestSecretProtector({ allowInsecureTestOnly: true }),
          publicOrigin: configuredOrigin,
          allowedReturnPaths: ["/", "/app"],
          now: () => new Date(now.value),
          randomOpaque: deterministicOpaque,
          createUuid: deterministicUuid,
        },
  });
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
    provider,
    repository,
    now,
    sessionCookieName,
    loginCookieName,
  };
};

const setCookies = (response: Response): string[] => {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.();
  if (values && values.length > 0) return values;
  const combined = response.headers.get("set-cookie");
  return combined ? combined.split(/,(?=[^;,]+=)/).map((value) => value.trim()) : [];
};

const cookiePair = (response: Response, name: string): string => {
  const value = setCookies(response).find((entry) => entry.startsWith(`${name}=`));
  assert.ok(value, `missing ${name} cookie in ${JSON.stringify(setCookies(response))}`);
  return value.split(";", 1)[0]!;
};

const cookieValue = (pair: string): string => pair.slice(pair.indexOf("=") + 1);

const beginLogin = async (harness: Harness, cookieHeader?: string) => {
  const response = await fetch(`${harness.baseUrl}/auth/login?return_to=%2F`, {
    redirect: "manual",
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });
  assert.equal(response.status, 302);
  const location = response.headers.get("location");
  assert.ok(location);
  const authorizationUrl = new URL(location);
  const state = authorizationUrl.searchParams.get("state");
  assert.ok(state);
  return {
    response,
    state,
    loginCookie: cookiePair(response, harness.loginCookieName),
  };
};

const completeCallback = async (
  harness: Harness,
  options: {
    state: string;
    loginCookie: string;
    code?: string;
    nonceOverride?: string | null;
    subject?: string;
  }
) => {
  const code = harness.provider.issueAuthorizationCode(
    options.state,
    {
      issuer: ISSUER,
      subject: options.subject ?? SUBJECT,
    },
    options.code,
    options.nonceOverride
  );
  const response = await fetch(
    `${harness.baseUrl}/auth/callback?state=${encodeURIComponent(options.state)}&code=${encodeURIComponent(code)}`,
    {
      redirect: "manual",
      headers: { cookie: options.loginCookie },
    }
  );
  return { response, code };
};

const bootstrapSession = async (harness: Harness, sessionCookie: string) => {
  const response = await fetch(`${harness.baseUrl}/auth/session`, {
    method: "POST",
    headers: {
      cookie: sessionCookie,
      origin: PUBLIC_ORIGIN,
      "x-session-bootstrap": "v1",
    },
  });
  const json = await response.json() as Record<string, unknown>;
  return {
    response,
    json,
    sessionCookie: response.status === 200
      ? cookiePair(response, harness.sessionCookieName)
      : null,
  };
};

describe("Feature 077 provider-neutral human session/BFF foundation", () => {
  it("completes login, maps only local roles, rotates on bootstrap, and logs out", async () => {
    const harness = await startHarness();
    const login = await beginLogin(harness);
    const callback = await completeCallback(harness, login);
    assert.equal(callback.response.status, 303);
    assert.equal(callback.response.headers.get("location"), "/");
    const initialSessionCookie = cookiePair(callback.response, harness.sessionCookieName);
    assert.match(setCookies(callback.response).join("\n"), /HttpOnly/);
    assert.match(setCookies(callback.response).join("\n"), /SameSite=Lax/);

    const session = await bootstrapSession(harness, initialSessionCookie);
    assert.equal(session.response.status, 200);
    assert.ok(session.sessionCookie);
    assert.notEqual(session.sessionCookie, initialSessionCookie);
    assert.deepEqual(session.json.roles, ["viewer"]);
    assert.ok((session.json.permissions as string[]).includes("evidence:query"));
    assert.ok(!(session.json.permissions as string[]).includes("platform:admin"));
    assert.equal(session.json.generation, 2);
    assert.match(String(session.json.csrf_token), /^[A-Za-z0-9_-]{43,172}$/);

    const logout = await fetch(`${harness.baseUrl}/auth/logout`, {
      method: "POST",
      headers: {
        cookie: session.sessionCookie!,
        origin: PUBLIC_ORIGIN,
        "x-csrf-token": String(session.json.csrf_token),
      },
    });
    assert.equal(logout.status, 200);
    assert.deepEqual(await logout.json(), { logged_out: true });

    const afterLogout = await bootstrapSession(harness, session.sessionCookie!);
    assert.equal(afterLogout.response.status, 401);
    assert.equal((afterLogout.json.error as { code: string }).code, "authentication_required");
  });

  it("fails closed when no approved provider is configured", async () => {
    const harness = await startHarness({ enabled: false });
    const response = await fetch(`${harness.baseUrl}/auth/login`, { redirect: "manual" });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: {
        code: "human_identity_unavailable",
        message: "Human sign-in is not configured",
      },
    });

    assert.throws(
      () => createHumanSessionBffDependencies({ enabled: true }),
      /explicitly approved/
    );
  });

  it("rejects malformed state, authorization code, and missing browser binding", async () => {
    const harness = await startHarness();
    const login = await beginLogin(harness);

    const malformedState = await fetch(
      `${harness.baseUrl}/auth/callback?state=bad&code=valid-code-12345`,
      { redirect: "manual", headers: { cookie: login.loginCookie } }
    );
    assert.equal(malformedState.status, 401);

    const malformedCode = await fetch(
      `${harness.baseUrl}/auth/callback?state=${login.state}&code=bad`,
      { redirect: "manual", headers: { cookie: login.loginCookie } }
    );
    assert.equal(malformedCode.status, 401);

    const code = harness.provider.issueAuthorizationCode(login.state, {
      issuer: ISSUER,
      subject: SUBJECT,
    });
    const missingBinding = await fetch(
      `${harness.baseUrl}/auth/callback?state=${login.state}&code=${encodeURIComponent(code)}`,
      { redirect: "manual" }
    );
    assert.equal(missingBinding.status, 401);
    assert.equal(
      (await missingBinding.json() as { error: { code: string } }).error.code,
      "human_authentication_failed"
    );
  });

  it("consumes state once and rejects authorization-code replay across transactions", async () => {
    const harness = await startHarness();
    const first = await beginLogin(harness);
    const firstCallback = await completeCallback(harness, {
      ...first,
      code: "shared-replay-code-0001",
    });
    assert.equal(firstCallback.response.status, 303);

    const stateReplay = await fetch(
      `${harness.baseUrl}/auth/callback?state=${first.state}&code=shared-replay-code-0001`,
      { redirect: "manual", headers: { cookie: first.loginCookie } }
    );
    assert.equal(stateReplay.status, 401);

    const second = await beginLogin(harness);
    const secondCallback = await completeCallback(harness, {
      ...second,
      code: "shared-replay-code-0001",
    });
    assert.equal(secondCallback.response.status, 401);
    assert.ok(harness.repository.authenticationFailures.some(
      (failure) => failure.reasonCode === "code_replay"
    ));
  });

  it("rejects malformed and mismatched nonce values", async () => {
    const malformedHarness = await startHarness();
    const malformedLogin = await beginLogin(malformedHarness);
    const malformed = await completeCallback(malformedHarness, {
      ...malformedLogin,
      nonceOverride: "bad",
    });
    assert.equal(malformed.response.status, 401);

    const mismatchHarness = await startHarness();
    const mismatchLogin = await beginLogin(mismatchHarness);
    const mismatch = await completeCallback(mismatchHarness, {
      ...mismatchLogin,
      nonceOverride: Buffer.alloc(32, 77).toString("base64url"),
    });
    assert.equal(mismatch.response.status, 401);
  });

  it("prevents session fixation and rejects Authorization headers on browser routes", async () => {
    const harness = await startHarness();
    const attackerToken = Buffer.alloc(32, 91).toString("base64url");
    const login = await beginLogin(harness, `la_muni_session=${attackerToken}`);
    assert.ok(setCookies(login.response).some(
      (value) => value.startsWith("la_muni_session=;") && value.includes("Max-Age=0")
    ));
    const callback = await completeCallback(harness, login);
    assert.equal(callback.response.status, 303);
    const issuedToken = cookieValue(cookiePair(callback.response, harness.sessionCookieName));
    assert.notEqual(issuedToken, attackerToken);

    const bearerAttempt = await fetch(`${harness.baseUrl}/auth/session`, {
      method: "POST",
      headers: {
        cookie: `la_muni_session=${issuedToken}`,
        origin: PUBLIC_ORIGIN,
        "x-session-bootstrap": "v1",
        authorization: `Bearer ${"x".repeat(40)}`,
      },
    });
    assert.equal(bearerAttempt.status, 400);
    assert.equal(
      (await bearerAttempt.json() as { error: { code: string } }).error.code,
      "invalid_browser_authentication"
    );
  });

  it("requires same-origin bootstrap proof before rotating the callback session", async () => {
    const harness = await startHarness();
    const login = await beginLogin(harness);
    const callback = await completeCallback(harness, login);
    const initialSessionCookie = cookiePair(callback.response, harness.sessionCookieName);

    const missingProof = await fetch(`${harness.baseUrl}/auth/session`, {
      method: "POST",
      headers: {
        cookie: initialSessionCookie,
        origin: PUBLIC_ORIGIN,
      },
    });
    assert.equal(missingProof.status, 403);

    const crossSite = await fetch(`${harness.baseUrl}/auth/session`, {
      method: "POST",
      headers: {
        cookie: initialSessionCookie,
        origin: PUBLIC_ORIGIN,
        "x-session-bootstrap": "v1",
        "sec-fetch-site": "cross-site",
      },
    });
    assert.equal(crossSite.status, 403);

    const valid = await bootstrapSession(harness, initialSessionCookie);
    assert.equal(valid.response.status, 200);
    assert.ok(valid.sessionCookie);
  });

  it("enforces same-origin CSRF and invalidates the old token on explicit rotation", async () => {
    const harness = await startHarness();
    const login = await beginLogin(harness);
    const callback = await completeCallback(harness, login);
    const initial = cookiePair(callback.response, harness.sessionCookieName);
    const session = await bootstrapSession(harness, initial);
    assert.ok(session.sessionCookie);
    const csrf = String(session.json.csrf_token);

    const missingOrigin = await fetch(`${harness.baseUrl}/auth/session/rotate`, {
      method: "POST",
      headers: { cookie: session.sessionCookie!, "x-csrf-token": csrf },
    });
    assert.equal(missingOrigin.status, 403);

    const wrongCsrf = await fetch(`${harness.baseUrl}/auth/session/rotate`, {
      method: "POST",
      headers: {
        cookie: session.sessionCookie!,
        origin: PUBLIC_ORIGIN,
        "x-csrf-token": Buffer.alloc(32, 10).toString("base64url"),
      },
    });
    assert.equal(wrongCsrf.status, 403);

    const rotated = await fetch(`${harness.baseUrl}/auth/session/rotate`, {
      method: "POST",
      headers: {
        cookie: session.sessionCookie!,
        origin: PUBLIC_ORIGIN,
        "x-csrf-token": csrf,
      },
    });
    assert.equal(rotated.status, 200);
    const rotatedJson = await rotated.json() as { csrf_token: string; generation: number };
    assert.equal(rotatedJson.generation, 3);
    const replacementCookie = cookiePair(rotated, harness.sessionCookieName);

    const oldToken = await bootstrapSession(harness, session.sessionCookie!);
    assert.equal(oldToken.response.status, 401);
    const replacement = await bootstrapSession(harness, replacementCookie);
    assert.equal(replacement.response.status, 200);
  });

  it("rejects expired sessions", async () => {
    const harness = await startHarness();
    const login = await beginLogin(harness);
    const callback = await completeCallback(harness, login);
    const sessionCookie = cookiePair(callback.response, harness.sessionCookieName);
    harness.now.value = new Date("2026-07-27T21:00:01.000Z");
    const expired = await bootstrapSession(harness, sessionCookie);
    assert.equal(expired.response.status, 401);
  });

  it("fails closed when one provider subject maps to multiple tenants", async () => {
    const harness = await startHarness({
      seeds: [
        membershipSeed(),
        membershipSeed(TENANT_B, PRINCIPAL_B, HUMAN_SUBJECT_B),
      ],
    });
    const login = await beginLogin(harness);
    const callback = await completeCallback(harness, login);
    assert.equal(callback.response.status, 403);
    assert.equal(
      (await callback.response.json() as { error: { code: string } }).error.code,
      "human_membership_required"
    );
  });

  it("revokes a newly created session when success auditing fails", async () => {
    class FailingAuditRepository extends InMemoryHumanSessionRepository {
      createdSessionTokenSha256: string | null = null;

      override async createSession(input: CreateHumanSessionInput): Promise<void> {
        this.createdSessionTokenSha256 = input.sessionTokenSha256;
        await super.createSession(input);
      }

      override async recordAudit(_input: HumanSessionAuditInput): Promise<void> {
        throw new Error("simulated audit sink failure");
      }
    }

    const repository = new FailingAuditRepository([membershipSeed()], deterministicUuid);
    const harness = await startHarness({ repository });
    const login = await beginLogin(harness);
    const callback = await completeCallback(harness, login);
    assert.equal(callback.response.status, 500);
    assert.equal(
      (await callback.response.json() as { error: { code: string } }).error.code,
      "internal_error"
    );
    assert.ok(setCookies(callback.response).some(
      (value) => value.startsWith(`${harness.sessionCookieName}=;`) && value.includes("Max-Age=0")
    ));
    assert.ok(repository.createdSessionTokenSha256);
    assert.equal(
      await repository.authenticateSession({
        sessionTokenSha256: repository.createdSessionTokenSha256!,
        now: new Date(harness.now.value),
      }),
      null
    );
  });

  it("keeps codes, cookies, subjects, issuer values, and provider claims out of audits", async () => {
    const harness = await startHarness();
    const login = await beginLogin(harness);
    const callback = await completeCallback(harness, login);
    const sessionCookie = cookiePair(callback.response, harness.sessionCookieName);
    const session = await bootstrapSession(harness, sessionCookie);
    assert.equal(session.response.status, 200);

    const persisted = JSON.stringify({
      audits: harness.repository.audits,
      failures: harness.repository.authenticationFailures,
    });
    for (const forbidden of [
      login.state,
      callback.code,
      cookieValue(login.loginCookie),
      cookieValue(sessionCookie),
      SUBJECT,
      ISSUER,
      "email",
      "display_name",
      "authorization_code",
    ]) {
      assert.ok(!persisted.includes(forbidden), `audit leaked ${forbidden}`);
    }
    assert.ok(harness.repository.audits.every((audit) =>
      Object.keys(audit).sort().join(",") ===
      "eventType,outcome,principalId,reasonCode,requestId,sessionId,tenantId"
    ));
  });

  it("uses Secure __Host cookies outside localhost", async () => {
    const harness = await startHarness({ publicOrigin: "https://app.example.test" });
    const login = await beginLogin(harness);
    const cookies = setCookies(login.response).join("\n");
    assert.match(cookies, /__Host-la_muni_login=/);
    assert.match(cookies, /__Host-la_muni_session=/);
    assert.match(cookies, /; Secure/);
    assert.match(cookies, /HttpOnly/);
    assert.match(cookies, /SameSite=Lax/);
    assert.doesNotMatch(cookies, /Domain=/i);
  });

  it("preserves existing service Bearer authentication semantics", async () => {
    const token = "existing-service-credential-00000001";
    let receivedHash = "";
    const principal = await authenticateBearer(`Bearer ${token}`, {
      async authenticateByCredentialHash(value) {
        receivedHash = value;
        return {
          credentialId: "77777777-7777-4777-8777-777777777777",
          tenantId: TENANT_A,
          principalId: "88888888-8888-4888-8888-888888888888",
          roles: ["integration_client"],
        };
      },
    });
    assert.equal(receivedHash, hashBearerCredential(token));
    assert.ok(principal.permissions.includes("integration:query"));
    assert.equal(principal.roles[0], "integration_client");
  });
});
