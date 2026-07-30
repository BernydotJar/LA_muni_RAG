import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { isCanonicalUuid } from "../security/index.js";
import { runEphemeralStaging } from "../staging/ephemeralStagingRunner.js";
import { PostgresEphemeralStagingExecutor } from "../staging/ephemeralStagingPostgresExecutor.js";
import { validateEphemeralStagingReceipt } from "../staging/ephemeralStagingReceipt.js";

const execFileAsync = promisify(execFile);
const projectRoot = process.cwd();
const adminDatabaseUrl = process.env.STAGING_ADMIN_DATABASE_URL;
if (!adminDatabaseUrl) throw new Error("STAGING_ADMIN_DATABASE_URL is required");
if (process.env.STAGING_CONFIRM_EPHEMERAL !== "true") throw new Error("STAGING_CONFIRM_EPHEMERAL=true is required");

const requestedRunId = process.env.STAGING_RUN_ID;
if (requestedRunId && !isCanonicalUuid(requestedRunId)) throw new Error("STAGING_RUN_ID must be a UUID");
const runId = requestedRunId?.toLowerCase() ?? randomUUID();
const cleanExisting = process.env.STAGING_CLEAN_EXISTING === "true";
if (process.env.STAGING_CLEAN_EXISTING && !["true", "false"].includes(process.env.STAGING_CLEAN_EXISTING)) {
  throw new Error("STAGING_CLEAN_EXISTING must be true or false");
}

const gitEnv = { PATH: process.env.PATH, LANG: process.env.LANG ?? "C.UTF-8" };
const [{ stdout }, { stdout: worktreeStatus }] = await Promise.all([
  execFileAsync("git", ["rev-parse", "HEAD"], {
    cwd: projectRoot, env: gitEnv, timeout: 10_000, maxBuffer: 64 * 1024,
  }),
  execFileAsync("git", ["status", "--porcelain", "--untracked-files=normal"], {
    cwd: projectRoot, env: gitEnv, timeout: 10_000, maxBuffer: 256 * 1024,
  }),
]);
const gitSha = stdout.trim();
if (!/^[0-9a-f]{40}$/.test(gitSha)) throw new Error("Unable to resolve immutable Git SHA");
if (worktreeStatus.trim()) throw new Error("Ephemeral staging requires a clean Git worktree");

const executor = new PostgresEphemeralStagingExecutor({ projectRoot, adminDatabaseUrl });
const receipt = await runEphemeralStaging({ executor, projectRoot, runId, gitSha, cleanExisting });
const validation = await validateEphemeralStagingReceipt(receipt, projectRoot);
if (validation.status !== "valid") throw new Error(`Staging receipt validation failed: ${validation.issues.join(",")}`);
const defaultReceipt = resolve(projectRoot, "artifacts", "staging", runId, "receipt.json");
const receiptPath = process.env.STAGING_RECEIPT_PATH
  ? resolve(projectRoot, process.env.STAGING_RECEIPT_PATH)
  : defaultReceipt;
const allowedRoot = resolve(projectRoot, "artifacts", "staging") + "/";
if (!receiptPath.startsWith(allowedRoot)) throw new Error("STAGING_RECEIPT_PATH must remain under artifacts/staging");
await mkdir(dirname(receiptPath), { recursive: true });
await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`${JSON.stringify({ ...receipt, receipt_path: receiptPath.slice(projectRoot.length + 1) }, null, 2)}\n`);
if (receipt.status !== "passed") process.exitCode = 1;
