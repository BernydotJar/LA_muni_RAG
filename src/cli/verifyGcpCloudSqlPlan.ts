import { readFile } from "node:fs/promises";
import { verifyCloudSqlTerraformPlan } from "../gcp/cloudSqlTerraformPlan.js";

const [planPath, projectId = "rag-municipalidades"] = process.argv.slice(2);

if (!planPath) {
  process.stderr.write("Usage: npm run gcp:cloudsql:verify-plan -- <plan.json> [project-id]\n");
  process.exitCode = 2;
} else {
  try {
    const plan = JSON.parse(await readFile(planPath, "utf8")) as unknown;
    const verification = verifyCloudSqlTerraformPlan(plan, {
      projectId,
      ownerLabel: "eduardo-sacahui",
      expectedComputeUsd: 0.351,
    });
    process.stdout.write(`${JSON.stringify(verification, null, 2)}\n`);
    if (verification.status !== "valid") process.exitCode = 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Cloud SQL plan verification failed: ${message}\n`);
    process.exitCode = 1;
  }
}
