import assert from "node:assert/strict";
import type { Server } from "node:http";
import { afterEach, describe, it } from "node:test";
import {
  DeterministicHumanIdentityProvider,
  DeterministicTestSecretProtector,
  HumanIdentityProviderUnavailableError,
  InMemoryHumanSessionRepository,
  InMemoryHumanSessionTelemetry,
  sha256Hex,
  type HumanSessionTelemetry,
  type HumanSessionTelemetryEvent,
} from "../humanSession/index.js";
import { createApiServer } from "../server.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const PRINCIPAL_ID = "22222222-2222-4222-8222-222222222222";
const HUMAN_SUBJECT_ID = "33333333-3333-4333-8333-333333333333";
const ISSUER = "https://issuer.reliability.test.invalid";
const SUBJECT = "opaque-reliability-subject";
const PUBLIC_ORIGIN = "http://localhost:3000";
const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) =>
    new Promise<void>((resolve) => server.close(() => resolve()))
  ));
});

class FailAuthenticateOnceRepository extends InMemoryHumanSessionRepository {
  failAuthenticate = true;

  override async authenticateSession(
    input: Parameters<InMemoryHumanSessionRepository["authenticateSession"]>[0]
  ): ReturnType<InMemoryHumanSessionRepository["authenticateSession"]> {
    if (this.failAuthenticate) {
      this.failAuthenticate = false;
      throw new Error("simulated repository outage with secret-cookie-value");
    }
    return super.authenticateSession(input);
  }
}

class FailExchangeOnceProvider extends DeterministicHumanIdentityProvider {
  failExchange = true;

  override async exchangeAuthorizationCode(
    input: Parameters<DeterministicHumanIdentityProvider["exchangeAuthorizationCode"]>[0]
  ): ReturnType<DeterministicHumanIdentityProvider["exchangeAuthorizationCode"]> {
    if (this.failExchange) {
      this.failExchange = false;
      throw new HumanIdentityProviderUnavailableError();
    }
    return super.exchangeAuthorizationCode(input);
  }
}

const membershipSeed = () => ({
  providerId: "local-test-provider",
  issuerSha256: sha256Hex(ISSUER),
  subjectSha256: sha256Hex(SUBJECT),
  membership: {
    humanSubjectId: HUMAN_SUBJECT_ID,
    tenantId: TENANT_ID,
    principalId: PRINCIPAL_ID,
    roles: ["viewer"] as const,
  },
});

interface Harness {
  baseUrl: string;
  provider: DeterministicHumanIdentityProvider;
  repository: InMemoryHumanSessionRepository;
  telemetry: HumanSessionTelemetry;
}

const startHarness = async (options: {
  provider?: DeterministicHumanIdentityProvider;
  repository?: InMemoryHumanSessionRepository;
  telemetry?: HumanSessionTelemetry;
  enabled?: boolean;
  monotonicNow?: () => number;
} = {}): Promise<Harness> => {
  const provider = options.provider ?? new DeterministicHumanIdentityProvider();
  const repository = options.repository ?? new InMemoryHumanSessionRepository([membershipSeed()]);
  const telemetry = options.telemetry ?? new InMemoryHumanSessionTelemetry();
  const server = createApiServer({
    humanSession: options.enabled === false
      ? { enabled: false, telemetry, monotonicNow: options.monotonicNow }
      : {
          enabled: true,
          approvedProvider: true,
          provider,
          repository,
          protector: new DeterministicTestSecretProtector({ allowInsecureTestOnly: true }),
          publicOrigin: PUBLIC_ORIGIN,
          telemetry,
          monotonicNow: options.monotonicNow,
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
  return { baseUrl: `http://127.0.0.1:${address.port}`, provider, repository, telemetry };
};

const setCookies = (response: Response): string[] => {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.();
  if (values?.length) return values;
  const combined = response.headers.get("set-cookie");
  return combined ? combined.split(/,(?=[^;,]+=)/).map((value) => value.trim()) : [];
};

const cookiePair = (response: Response, name: string): string => {
  const value = setCookies(response).find((entry) => entry.startsWith(`${name}=`));
  assert.ok(value, `missing ${name} cookie`);
  return value.split(";", 1)[0]!;
};

const beginLogin = async (harness: Harness) => {
  const response = await fetch(`${harness.baseUrl}/auth/login?return_to=%2Fapp`, {
    redirect: "manual",
  });
  assert.equal(response.status, 302);
  const location = response.headers.get("location");
  assert.ok(location);
  const state = new URL(location).searchParams.get("state");
  assert.ok(state);
  return { state, loginCookie: cookiePair(response, "la_muni_login") };
};

const callback = async (harness: Harness, login: { state: string; loginCookie: string }) => {
  const code = harness.provider.issueAuthorizationCode(login.state, {
    issuer: ISSUER,
    subject: SUBJECT,
  });
  const response = await fetch(
    `${harness.baseUrl}/auth/callback?state=${encodeURIComponent(login.state)}&code=${encodeURIComponent(code)}`,
    { redirect: "manual", headers: { cookie: login.loginCookie } }
  );
  return { response, code };
};

const bootstrap = async (harness: Harness, sessionCookie: string) => {
  const response = await fetch(`${harness.baseUrl}/auth/session`, {
    method: "POST",
    headers: {
      cookie: sessionCookie,
      origin: PUBLIC_ORIGIN,
      "x-session-bootstrap": "v1",
    },
  });
  const body = await response.json() as Record<string, unknown>;
  return {
    response,
    body,
    sessionCookie: response.ok ? cookiePair(response, "la_muni_session") : null,
  };
};

describe("Feature 079 human-session reliability and telemetry", () => {
  it("records only closed low-cardinality telemetry fields", async () => {
    const telemetry = new InMemoryHumanSessionTelemetry();
    const harness = await startHarness({ telemetry });
    const login = await beginLogin(harness);
    const completed = await callback(harness, login);
    assert.equal(completed.response.status, 303);
    const initialCookie = cookiePair(completed.response, "la_muni_session");
    const session = await bootstrap(harness, initialCookie);
    assert.equal(session.response.status, 200);
    assert.ok(session.sessionCookie);
    const logout = await fetch(`${harness.baseUrl}/auth/logout`, {
      method: "POST",
      headers: {
        cookie: session.sessionCookie,
        origin: PUBLIC_ORIGIN,
        "x-csrf-token": String(session.body.csrf_token),
      },
    });
    assert.equal(logout.status, 200);

    assert.deepEqual(
      telemetry.events.map((event) => event.operation),
      ["login", "callback", "session_bootstrap", "logout"]
    );
    assert.ok(telemetry.events.every((event) =>
      Object.keys(event).sort().join(",") === "durationMs,method,operation,outcome,statusCode"
    ));
    assert.equal(telemetry.summary().count, 4);
    assert.equal(telemetry.summary().successCount, 4);
    const serialized = JSON.stringify(telemetry.events);
    for (const forbidden of [
      login.state,
      completed.code,
      SUBJECT,
      ISSUER,
      initialCookie,
      session.sessionCookie,
      String(session.body.csrf_token),
      TENANT_ID,
      PRINCIPAL_ID,
    ]) {
      assert.equal(serialized.includes(forbidden), false, `telemetry leaked ${forbidden}`);
    }
  });

  it("isolates telemetry exporter failure from the authentication response", async () => {
    const telemetry: HumanSessionTelemetry = {
      record(_event: HumanSessionTelemetryEvent) {
        throw new Error("simulated exporter outage");
      },
    };
    const harness = await startHarness({
      enabled: false,
      telemetry,
      monotonicNow() {
        throw new Error("simulated monotonic clock outage");
      },
    });
    const response = await fetch(`${harness.baseUrl}/auth/session`, {
      method: "POST",
      headers: { origin: PUBLIC_ORIGIN, "x-session-bootstrap": "v1" },
    });
    assert.equal(response.status, 503);
    assert.equal(
      (await response.json() as { error: { code: string } }).error.code,
      "human_identity_unavailable"
    );
  });

  it("returns a generic error for a transient repository outage and recovers the same session", async () => {
    const telemetry = new InMemoryHumanSessionTelemetry();
    const repository = new FailAuthenticateOnceRepository([membershipSeed()]);
    const harness = await startHarness({ repository, telemetry });
    const login = await beginLogin(harness);
    const completed = await callback(harness, login);
    const sessionCookie = cookiePair(completed.response, "la_muni_session");

    const failed = await bootstrap(harness, sessionCookie);
    assert.equal(failed.response.status, 500);
    assert.deepEqual(failed.body, {
      error: { code: "internal_error", message: "Unexpected server error" },
    });
    assert.equal(JSON.stringify(failed.body).includes("secret-cookie-value"), false);

    const recovered = await bootstrap(harness, sessionCookie);
    assert.equal(recovered.response.status, 200);
    assert.ok(recovered.sessionCookie);
    assert.equal(telemetry.summary("session_bootstrap").serverErrorCount, 1);
    assert.equal(telemetry.summary("session_bootstrap").successCount, 1);
  });

  it("requires a fresh login after a transient provider exchange failure", async () => {
    const provider = new FailExchangeOnceProvider();
    const telemetry = new InMemoryHumanSessionTelemetry();
    const harness = await startHarness({ provider, telemetry });
    const firstLogin = await beginLogin(harness);
    const failed = await callback(harness, firstLogin);
    assert.equal(failed.response.status, 503);
    const failedBody = await failed.response.json() as { error: { code: string; message: string } };
    assert.deepEqual(failedBody, {
      error: {
        code: "human_identity_unavailable",
        message: "Human sign-in is temporarily unavailable",
      },
    });
    assert.equal(JSON.stringify(failedBody).includes("authorization-code-secret"), false);
    assert.ok(setCookies(failed.response).some((value) => value.startsWith("la_muni_session=;")));

    const secondLogin = await beginLogin(harness);
    const recovered = await callback(harness, secondLogin);
    assert.equal(recovered.response.status, 303);
    assert.ok(cookiePair(recovered.response, "la_muni_session"));
    assert.equal(telemetry.summary("callback").unavailableCount, 1);
    assert.equal(telemetry.summary("callback").successCount, 1);
  });

  it("allows exactly one winner during concurrent rotation and preserves the replacement", async () => {
    const telemetry = new InMemoryHumanSessionTelemetry();
    const harness = await startHarness({ telemetry });
    const login = await beginLogin(harness);
    const completed = await callback(harness, login);
    const initialCookie = cookiePair(completed.response, "la_muni_session");
    const session = await bootstrap(harness, initialCookie);
    assert.ok(session.sessionCookie);
    const headers = {
      cookie: session.sessionCookie,
      origin: PUBLIC_ORIGIN,
      "x-csrf-token": String(session.body.csrf_token),
    };

    const responses = await Promise.all([
      fetch(`${harness.baseUrl}/auth/session/rotate`, { method: "POST", headers }),
      fetch(`${harness.baseUrl}/auth/session/rotate`, { method: "POST", headers }),
    ]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 401]);
    const winner = responses.find((response) => response.status === 200);
    assert.ok(winner);
    const replacementCookie = cookiePair(winner, "la_muni_session");

    const oldSession = await bootstrap(harness, session.sessionCookie);
    assert.equal(oldSession.response.status, 401);
    const replacement = await bootstrap(harness, replacementCookie);
    assert.equal(replacement.response.status, 200);
    assert.equal(telemetry.summary("session_rotate").successCount, 1);
    assert.equal(telemetry.summary("session_rotate").deniedCount, 1);
  });
});
