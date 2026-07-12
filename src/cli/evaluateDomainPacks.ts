import {
  DOMAIN_PACKS,
} from "../domain/registry.js";
import {
  evaluateDomainPacks,
  formatDomainPackEvalReport,
} from "../domain/evaluation.js";

export const runDomainPackEvalCli = (): number => {
  const results = evaluateDomainPacks(Object.values(DOMAIN_PACKS));
  console.log(formatDomainPackEvalReport(results));
  return results.some((result) => result.summary.failedCases > 0) ? 1 : 0;
};

if (process.argv[1]?.endsWith("evaluateDomainPacks.ts") || process.argv[1]?.endsWith("evaluateDomainPacks.js")) {
  process.exitCode = runDomainPackEvalCli();
}
