import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import {
  InMemoryHumanSessionTelemetry,
  NoopHumanSessionTelemetry,
  type HumanSessionTelemetryEvent,
} from "../humanSession/index.js";

const read = (path: string): Promise<string> => readFile(path, "utf8");

describe("EVAL-HUMAN-SESSION-RELIABILITY-001", () => {
  it("enforces an exact low-cardinality telemetry event", () => {
    const telemetry = new InMemoryHumanSessionTelemetry();
    const valid: HumanSessionTelemetryEvent = {
      operation: "session_bootstrap",
      method: "POST",
      outcome: "success",
      statusCode: 200,
      durationMs: 12.345,
    };
    telemetry.record(valid);
    assert.deepEqual(Object.keys(telemetry.events[0]!).sort(), [
      "durationMs", "method", "operation", "outcome", "statusCode",
    ]);
    assert.throws(
      () => telemetry.record({ ...valid, tenantId: "forbidden" } as never),
      /unexpected fields/
    );
    assert.throws(
      () => telemetry.record({ ...valid, operation: "unknown" } as never),
      /Invalid human session telemetry event/
    );
  });

  it("uses a no-op default and isolates exporter failures", async () => {
    const telemetry = new NoopHumanSessionTelemetry();
    assert.doesNotThrow(() => telemetry.record({
      operation: "login",
      method: "GET",
      outcome: "success",
      statusCode: 302,
      durationMs: 0,
    }));
    const index = await read("src/humanSession/index.ts");
    const handler = await read("src/humanSession/handler.ts");
    assert.match(index, /telemetry: options\.telemetry \?\? new NoopHumanSessionTelemetry\(\)/);
    assert.match(handler, /Telemetry is observational only and can never alter authentication behavior/);
    assert.match(handler, /catch \{[\s\S]*?authentication behavior/);
  });

  it("measures with a monotonic clock and bounds duration", async () => {
    const index = await read("src/humanSession/index.ts");
    const handler = await read("src/humanSession/handler.ts");
    assert.match(index, /performance\.now\(\)/);
    assert.match(handler, /safeMonotonicNow\(dependencies\)/);
    assert.match(handler, /const value = dependencies\.monotonicNow\(\)/);
    assert.match(handler, /Math\.min\(60_000, Math\.max\(0/);
    assert.match(handler, /rawDuration\.toFixed\(3\)/);
    assert.doesNotMatch(handler, /Date\.now\(\).*duration/i);
  });

  it("keeps identity, session, network and error text out of telemetry", async () => {
    const types = await read("src/humanSession/types.ts");
    const telemetry = await read("src/humanSession/telemetry.ts");
    const contract = types.slice(
      types.indexOf("export interface HumanSessionTelemetryEvent"),
      types.indexOf("export interface HumanSessionTelemetry")
    );
    assert.doesNotMatch(
      contract,
      /tenant|principal|subject|sessionId|requestId|role|permission|state|nonce|code|cookie|csrf|issuer|url|userAgent|ip|body|query|error/i
    );
    assert.match(telemetry, /durationMs,method,operation,outcome,statusCode/);
    assert.doesNotMatch(telemetry, /console\.|process\.stdout|process\.stderr/);
  });

  it("covers repository, provider, exporter and concurrent-rotation failures", async () => {
    const test = await read("src/__tests__/human-session-reliability-v1.test.ts");
    assert.match(test, /FailAuthenticateOnceRepository/);
    assert.match(test, /FailExchangeOnceProvider/);
    assert.match(test, /simulated exporter outage/);
    assert.match(test, /allows exactly one winner during concurrent rotation/);
    assert.match(test, /responses\.map\(\(response\) => response\.status\)\.sort\(\), \[200, 401\]/);
    assert.match(test, /same session/);
    assert.match(test, /fresh login/);
  });

  it("defines a bounded local workload and conservative thresholds", async () => {
    const harness = await read("scripts/human-session-reliability-harness.mjs");
    assert.match(harness, /SHELL_WARMUP_REQUESTS = 12/);
    assert.match(harness, /SHELL_REQUESTS = 80/);
    assert.match(harness, /ANONYMOUS_DENIALS = 40/);
    assert.match(harness, /LIFECYCLE_CYCLES = 24/);
    assert.match(harness, /CONCURRENCY = 6/);
    assert.match(harness, /SHELL_P95_LIMIT_MS = 500/);
    assert.match(harness, /BFF_P95_LIMIT_MS = 750/);
    assert.match(harness, /SINGLE_REQUEST_MAX_MS = 2_500/);
    assert.match(harness, /await runPool\(SHELL_WARMUP_REQUESTS/);
    assert.match(harness, /shellWarmupRequests: SHELL_WARMUP_REQUESTS/);
    assert.match(harness, /expectedTelemetryEvents = ANONYMOUS_DENIALS \+ LIFECYCLE_CYCLES \* 5/);
    assert.match(harness, /unexpectedFailures, 0/);
  });

  it("explicitly rejects a productive SLO or journey claim", async () => {
    const harness = await read("scripts/human-session-reliability-harness.mjs");
    const spec = await read("specs/079-human-session-reliability-v1/spec.md");
    const operations = await read("docs/operations/human-session-reliability.md");
    assert.match(harness, /classification: "local_non_productive_slo_evidence"/);
    assert.match(harness, /productiveSloClaim: false/);
    assert.match(harness, /productiveAuthenticatedJourneys: "0\/12"/);
    assert.match(spec, /not a production SLO/i);
    assert.match(spec, /not production readiness/i);
    assert.match(operations, /official productive authenticated browser result remains `0\/12`/i);
  });

  it("documents productive observability and recovery gaps", async () => {
    const adr = await read("docs/decisions/079-human-session-local-reliability-evidence.md");
    const risk = await read("docs/risks/079-human-session-reliability-risk-register.md");
    const review = await read("docs/reviews/079-human-session-reliability-independent-review.md");
    assert.match(adr, /productive exporter, dashboards, alerts, burn rates and on-call ownership/);
    assert.match(adr, /restart, failover, backup restore and regional recovery/);
    assert.match(risk, /Loopback latency could be misreported as a production SLO/);
    assert.match(review, /not production ready/i);
  });

  it("wires focused, harness, named-EVAL and CI commands", async () => {
    const packageJson = JSON.parse(await read("package.json")) as { scripts: Record<string, string> };
    assert.match(packageJson.scripts["test:human-session-reliability"] ?? "", /human-session-reliability-v1/);
    assert.match(packageJson.scripts["smoke:human-session-reliability"] ?? "", /human-session-reliability-harness/);
    assert.match(packageJson.scripts["eval:human-session-reliability"] ?? "", /eval-human-session-reliability-001/);
    const ci = await read(".github/workflows/ci.yml");
    assert.match(ci, /EVAL-HUMAN-SESSION-RELIABILITY-001/);
    assert.match(ci, /smoke:human-session-reliability/);
  });
});
