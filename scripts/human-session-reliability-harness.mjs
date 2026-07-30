#!/usr/bin/env node
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  DeterministicHumanIdentityProvider,
  DeterministicTestSecretProtector,
  InMemoryHumanSessionRepository,
  InMemoryHumanSessionTelemetry,
  sha256Hex,
} from "../dist/humanSession/index.js";
import { createApiServer } from "../dist/server.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const PRINCIPAL_ID = "22222222-2222-4222-8222-222222222222";
const HUMAN_SUBJECT_ID = "33333333-3333-4333-8333-333333333333";
const ISSUER = "https://issuer.reliability.test.invalid";
const SUBJECT = "opaque-reliability-load-subject";
const PUBLIC_ORIGIN = "http://localhost:3000";
const SHELL_WARMUP_REQUESTS = 12;
const SHELL_REQUESTS = 80;
const ANONYMOUS_DENIALS = 40;
const LIFECYCLE_CYCLES = 24;
const CONCURRENCY = 6;
const SHELL_P95_LIMIT_MS = 500;
const BFF_P95_LIMIT_MS = 750;
const SINGLE_REQUEST_MAX_MS = 2_500;

const provider = new DeterministicHumanIdentityProvider();
const telemetry = new InMemoryHumanSessionTelemetry();
const repository = new InMemoryHumanSessionRepository([{
  providerId: provider.providerId,
  issuerSha256: sha256Hex(ISSUER),
  subjectSha256: sha256Hex(SUBJECT),
  membership: {
    humanSubjectId: HUMAN_SUBJECT_ID,
    tenantId: TENANT_ID,
    principalId: PRINCIPAL_ID,
    roles: ["viewer"],
  },
}]);
const server = createApiServer({
  legacyApiEnabled: false,
  humanSession: {
    enabled: true,
    approvedProvider: true,
    provider,
    repository,
    protector: new DeterministicTestSecretProtector({ allowInsecureTestOnly: true }),
    publicOrigin: PUBLIC_ORIGIN,
    telemetry,
  },
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    server.off("error", reject);
    resolve();
  });
});
const address = server.address();
assert.ok(address && typeof address === "object");
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
const percentile = (values, fraction) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return Number(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)].toFixed(3));
};
const timedFetch = async (url, options) => {
  const startedAt = performance.now();
  const response = await fetch(url, options);
  return { response, durationMs: performance.now() - startedAt };
};
const runPool = async (count, worker) => {
  let next = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, count) }, async () => {
    while (true) {
      const index = next;
      next += 1;
      if (index >= count) return;
      await worker(index);
    }
  });
  await Promise.all(workers);
};

const shellDurations = [];
const anonymousDurations = [];
const lifecycleDurations = [];
let unexpectedFailures = 0;

const lifecycle = async (index) => {
  const cycleStartedAt = performance.now();
  const login = await fetch(`${baseUrl}/auth/login?return_to=%2Fapp`, { redirect: "manual" });
  if (login.status !== 302) throw new Error(`cycle ${index} login status ${login.status}`);
  const authorizationUrl = new URL(login.headers.get("location"));
  const state = authorizationUrl.searchParams.get("state");
  assert.ok(state);
  const loginCookie = cookiePair(login, "la_muni_login");
  const code = provider.issueAuthorizationCode(state, { issuer: ISSUER, subject: SUBJECT });
  const callback = await fetch(
    `${baseUrl}/auth/callback?state=${encodeURIComponent(state)}&code=${encodeURIComponent(code)}`,
    { redirect: "manual", headers: { cookie: loginCookie } }
  );
  if (callback.status !== 303) throw new Error(`cycle ${index} callback status ${callback.status}`);
  const initialCookie = cookiePair(callback, "la_muni_session");
  const bootstrap = await fetch(`${baseUrl}/auth/session`, {
    method: "POST",
    headers: {
      cookie: initialCookie,
      origin: PUBLIC_ORIGIN,
      "x-session-bootstrap": "v1",
    },
  });
  if (bootstrap.status !== 200) throw new Error(`cycle ${index} bootstrap status ${bootstrap.status}`);
  const session = await bootstrap.json();
  const activeCookie = cookiePair(bootstrap, "la_muni_session");
  const rotate = await fetch(`${baseUrl}/auth/session/rotate`, {
    method: "POST",
    headers: {
      cookie: activeCookie,
      origin: PUBLIC_ORIGIN,
      "x-csrf-token": session.csrf_token,
    },
  });
  if (rotate.status !== 200) throw new Error(`cycle ${index} rotate status ${rotate.status}`);
  const rotated = await rotate.json();
  const rotatedCookie = cookiePair(rotate, "la_muni_session");
  const logout = await fetch(`${baseUrl}/auth/logout`, {
    method: "POST",
    headers: {
      cookie: rotatedCookie,
      origin: PUBLIC_ORIGIN,
      "x-csrf-token": rotated.csrf_token,
    },
  });
  if (logout.status !== 200) throw new Error(`cycle ${index} logout status ${logout.status}`);
  lifecycleDurations.push(performance.now() - cycleStartedAt);
};

try {
  await runPool(SHELL_WARMUP_REQUESTS, async () => {
    const response = await fetch(`${baseUrl}/app`, { cache: "no-store" });
    if (response.status !== 200 || response.headers.get("cache-control") !== "no-store, max-age=0") {
      unexpectedFailures += 1;
    }
    await response.arrayBuffer();
  });
  const startedAt = performance.now();
  await runPool(SHELL_REQUESTS, async () => {
    const result = await timedFetch(`${baseUrl}/app`, { cache: "no-store" });
    shellDurations.push(result.durationMs);
    if (result.response.status !== 200 || result.response.headers.get("cache-control") !== "no-store, max-age=0") {
      unexpectedFailures += 1;
    }
    await result.response.arrayBuffer();
  });
  await runPool(ANONYMOUS_DENIALS, async () => {
    const result = await timedFetch(`${baseUrl}/auth/session`, {
      method: "POST",
      headers: { origin: PUBLIC_ORIGIN, "x-session-bootstrap": "v1" },
    });
    anonymousDurations.push(result.durationMs);
    if (result.response.status !== 401) unexpectedFailures += 1;
    await result.response.arrayBuffer();
  });
  await runPool(LIFECYCLE_CYCLES, lifecycle);
  const totalDurationMs = performance.now() - startedAt;

  const shellP95Ms = percentile(shellDurations, 0.95);
  const anonymousP95Ms = percentile(anonymousDurations, 0.95);
  const lifecycleP95Ms = percentile(lifecycleDurations, 0.95);
  const telemetrySummary = telemetry.summary();
  const expectedTelemetryEvents = ANONYMOUS_DENIALS + LIFECYCLE_CYCLES * 5;

  assert.equal(unexpectedFailures, 0);
  assert.equal(telemetrySummary.count, expectedTelemetryEvents);
  assert.equal(telemetrySummary.serverErrorCount, 0);
  assert.equal(telemetrySummary.unavailableCount, 0);
  assert.equal(telemetrySummary.deniedCount, ANONYMOUS_DENIALS);
  assert.equal(telemetrySummary.successCount, LIFECYCLE_CYCLES * 5);
  assert.ok(shellP95Ms <= SHELL_P95_LIMIT_MS, `shell p95 ${shellP95Ms}ms exceeded ${SHELL_P95_LIMIT_MS}ms`);
  assert.ok(telemetrySummary.p95Ms <= BFF_P95_LIMIT_MS, `BFF p95 ${telemetrySummary.p95Ms}ms exceeded ${BFF_P95_LIMIT_MS}ms`);
  assert.ok(telemetrySummary.maxMs <= SINGLE_REQUEST_MAX_MS, `BFF max ${telemetrySummary.maxMs}ms exceeded ${SINGLE_REQUEST_MAX_MS}ms`);

  console.log(JSON.stringify({
    status: "human_session_reliability_harness_passed",
    classification: "local_non_productive_slo_evidence",
    workload: {
      shellWarmupRequests: SHELL_WARMUP_REQUESTS,
      shellRequests: SHELL_REQUESTS,
      anonymousDenials: ANONYMOUS_DENIALS,
      lifecycleCycles: LIFECYCLE_CYCLES,
      concurrency: CONCURRENCY,
      totalBffEvents: telemetrySummary.count,
    },
    latencyMs: {
      shellP95: shellP95Ms,
      anonymousP95: percentile(anonymousDurations, 0.95),
      lifecycleP95: lifecycleP95Ms,
      bffP50: telemetrySummary.p50Ms,
      bffP95: telemetrySummary.p95Ms,
      bffMax: telemetrySummary.maxMs,
    },
    outcomes: {
      success: telemetrySummary.successCount,
      expectedDenied: telemetrySummary.deniedCount,
      unavailable: telemetrySummary.unavailableCount,
      serverError: telemetrySummary.serverErrorCount,
      unexpectedFailures,
    },
    elapsedMs: Number(totalDurationMs.toFixed(3)),
    productiveSloClaim: false,
    productiveAuthenticatedJourneys: "0/12",
  }));
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
