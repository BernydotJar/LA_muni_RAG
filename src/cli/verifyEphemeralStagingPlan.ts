import { verifyEphemeralStagingPlan } from "../staging/ephemeralStagingPlan.js";

const result = await verifyEphemeralStagingPlan(process.cwd());

process.stdout.write(`${JSON.stringify({
  status: result.status,
  summary: result.summary,
  issues: result.issues,
}, null, 2)}\n`);

if (result.status !== "valid") process.exitCode = 1;
