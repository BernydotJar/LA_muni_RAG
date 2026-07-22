import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadEphemeralStagingPlan } from "../staging/ephemeralStagingPlan.js";
import {
  STAGING_DATABASE_SCENARIOS,
  assertStagingJourneyCoverage,
  assertSafeStagingAdminUrl,
  runEphemeralStaging,
  type EphemeralStagingExecutor,
} from "../staging/ephemeralStagingRunner.js";
import { validateEphemeralStagingReceipt } from "../staging/ephemeralStagingReceipt.js";

class RecordingExecutor implements EphemeralStagingExecutor {
  readonly calls: string[] = [];
  failSmoke: string | null = null;
  existing = false;

  async preflight(): Promise<void> { this.calls.push("preflight"); }
  async cleanKnownEnvironment(): Promise<void> { this.calls.push("clean"); this.existing = false; }
  async environmentExists(): Promise<boolean> { this.calls.push("exists"); return this.existing; }
  async build(): Promise<void> { this.calls.push("build"); }
  async createDatabase(name: string): Promise<void> { this.calls.push(`create:${name}`); }
  async recreateDatabase(name: string): Promise<void> { this.calls.push(`recreate:${name}`); }
  async applySql(database: string, file: string): Promise<void> { this.calls.push(`sql:${database}:${file}`); }
  async runSmoke(smoke: { id: string }): Promise<void> {
    this.calls.push(`smoke:${smoke.id}`);
    if (smoke.id === this.failSmoke) throw new Error("synthetic failure with secret-token-must-not-leak");
  }
  async dropDatabase(name: string): Promise<boolean> { this.calls.push(`drop:${name}`); return true; }
  async dropRole(name: string): Promise<boolean> { this.calls.push(`role:${name}`); return true; }
}

describe("ephemeral staging runner v1", () => {
  it("maps every runnable API journey exactly once and maps no browser journey", async () => {
    const plan = await loadEphemeralStagingPlan(process.cwd());
    const result = assertStagingJourneyCoverage(plan, STAGING_DATABASE_SCENARIOS);
    assert.equal(result.apiJourneyCount, 20);
    assert.equal(result.browserJourneyCount, 12);
    assert.equal(result.mappedJourneyCount, 20);
    assert.deepEqual(result.missingJourneyIds, []);
    assert.deepEqual(result.duplicateJourneyIds, []);
    assert.deepEqual(result.browserJourneyIds, []);
  });

  it("rejects non-loopback, credential-less, query-bearing and non-admin URLs", () => {
    assert.doesNotThrow(() => assertSafeStagingAdminUrl(
      "postgresql://postgres:ephemeral@127.0.0.1:5432/postgres"
    ));
    for (const value of [
      "postgresql://postgres:secret@db.example.com:5432/postgres",
      "postgresql://127.0.0.1:5432/postgres",
      "postgresql://postgres:secret@127.0.0.1:5432/municipal_prod",
      "postgresql://postgres:secret@127.0.0.1:5432/postgres?sslmode=require",
      "https://postgres:secret@127.0.0.1/postgres",
    ]) assert.throws(() => assertSafeStagingAdminUrl(value));
  });

  it("runs deterministic phases and always destroys databases and roles", async () => {
    const executor = new RecordingExecutor();
    const receipt = await runEphemeralStaging({
      executor,
      projectRoot: process.cwd(),
      runId: "00000000-0000-4000-8000-000000000073",
      gitSha: "a".repeat(40),
      now: (() => {
        let tick = 0;
        return () => new Date(Date.UTC(2026, 6, 22, 21, 0, tick++));
      })(),
    });
    assert.equal(receipt.status, "passed");
    assert.equal(receipt.journeys.length, 20);
    assert.ok(receipt.journeys.every((item) => item.status === "passed"));
    assert.equal(receipt.browser.blocked, 12);
    assert.equal(receipt.cleanup.databases_destroyed, 4);
    assert.equal(receipt.cleanup.roles_destroyed, 3);
    assert.equal(executor.calls.includes("role:la_muni_runtime_test"), true);
    assert.equal(executor.calls.at(-1), "exists");
    assert.equal(JSON.stringify(receipt).includes("password"), false);
    assert.equal(JSON.stringify(receipt).includes("DATABASE_URL"), false);
    assert.deepEqual(await validateEphemeralStagingReceipt(receipt, process.cwd()), { status: "valid", issues: [] });
  });

  it("rejects duplicate journeys and sensitive receipt drift", async () => {
    const executor = new RecordingExecutor();
    const receipt = await runEphemeralStaging({
      executor, projectRoot: process.cwd(),
      runId: "00000000-0000-4000-8000-000000000078",
      gitSha: "e".repeat(40),
      now: () => new Date("2026-07-22T21:00:00.000Z"),
    });
    receipt.journeys[1]!.id = receipt.journeys[0]!.id;
    (receipt as unknown as Record<string, unknown>).password = "secret-token-must-not-exist";
    const validation = await validateEphemeralStagingReceipt(receipt, process.cwd());
    assert.equal(validation.status, "invalid");
    assert.ok(validation.issues.includes("duplicate_journey"));
    assert.ok(validation.issues.includes("sensitive_material_in_receipt"));
  });

  it("fails closed on a smoke error but still destroys every created database and role", async () => {
    const executor = new RecordingExecutor();
    executor.failSmoke = "workflow-lifecycle";
    const receipt = await runEphemeralStaging({
      executor,
      projectRoot: process.cwd(),
      runId: "00000000-0000-4000-8000-000000000074",
      gitSha: "b".repeat(40),
      now: () => new Date("2026-07-22T21:00:00.000Z"),
    });
    assert.equal(receipt.status, "failed");
    assert.deepEqual(receipt.failure, {
      phase: "verify_api_system_journeys",
      subject: "workflow-lifecycle",
      code: "smoke_failed",
    });
    assert.equal(receipt.cleanup.databases_destroyed, 4);
    assert.equal(receipt.cleanup.roles_destroyed, 3);
    assert.equal(JSON.stringify(receipt).includes("secret-token"), false);
  });

  it("refuses a dirty environment unless explicit cleanup is enabled", async () => {
    const executor = new RecordingExecutor();
    executor.existing = true;
    const receipt = await runEphemeralStaging({
      executor,
      projectRoot: process.cwd(),
      runId: "00000000-0000-4000-8000-000000000075",
      gitSha: "c".repeat(40),
      now: () => new Date("2026-07-22T21:00:00.000Z"),
    });
    assert.equal(receipt.status, "failed");
    assert.equal(receipt.failure?.code, "environment_not_clean");
    assert.equal(executor.calls.includes("clean"), false);
    assert.equal(executor.calls.some((call) => call.startsWith("drop:") || call.startsWith("role:")), false);
    assert.deepEqual(receipt.cleanup, { databases_destroyed: 0, roles_destroyed: 0, complete: true });

    const cleanExecutor = new RecordingExecutor();
    cleanExecutor.existing = true;
    const cleanReceipt = await runEphemeralStaging({
      executor: cleanExecutor,
      projectRoot: process.cwd(),
      runId: "00000000-0000-4000-8000-000000000076",
      gitSha: "d".repeat(40),
      cleanExisting: true,
      now: () => new Date("2026-07-22T21:00:00.000Z"),
    });
    assert.equal(cleanReceipt.status, "passed");
    assert.equal(cleanExecutor.calls.includes("clean"), true);
  });
});
