import type { EvidenceItem } from "../evidence.js";
import { classifyProcedureQuery } from "../procedure/procedureClassifier.js";
import { classifySourceAuthority } from "../procedure/procedureAuthorities.js";
import type { DomainEvaluationCase, DomainPack } from "./types.js";

export type DomainPackEvalFailureReason =
  | "workflow_type_mismatch"
  | "source_authority_mismatch"
  | "invalid_eval_case";

export interface DomainPackEvalCaseResult {
  domainPackId: string;
  id: string;
  query: string;
  status: "passed" | "failed";
  expectedWorkflowType: string;
  actualWorkflowType: string | null;
  expectedAuthorityClass: string | null;
  actualAuthorityClass: string | null;
  failureReasons: DomainPackEvalFailureReason[];
}

export interface DomainPackEvalSummary {
  domainPackId: string;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  passRate: number;
}

export interface DomainPackEvalResult {
  summary: DomainPackEvalSummary;
  cases: DomainPackEvalCaseResult[];
}

const syntheticEvidenceForCase = (testCase: DomainEvaluationCase): EvidenceItem => ({
  documentTitle: testCase.query,
  sourceType: "manual",
  citationLabel: testCase.query,
  pageStart: null,
  excerpt: testCase.notes,
  score: null,
  retrievalMode: "keyword",
  sourceUrl: null,
});

const evaluateCase = (pack: DomainPack, testCase: DomainEvaluationCase): DomainPackEvalCaseResult => {
  const failureReasons: DomainPackEvalFailureReason[] = [];

  if (!testCase.id.trim() || !testCase.query.trim() || !testCase.expectedWorkflowType.trim()) {
    failureReasons.push("invalid_eval_case");
  }

  const classification = classifyProcedureQuery(testCase.query, pack);
  const actualWorkflowType = classification.procedureType;
  if (actualWorkflowType !== testCase.expectedWorkflowType) {
    failureReasons.push("workflow_type_mismatch");
  }

  const actualAuthorityClass = testCase.expectedAuthorityClass
    ? classifySourceAuthority(syntheticEvidenceForCase(testCase), pack)
    : null;
  if (testCase.expectedAuthorityClass && actualAuthorityClass !== testCase.expectedAuthorityClass) {
    failureReasons.push("source_authority_mismatch");
  }

  return {
    domainPackId: pack.id,
    id: testCase.id,
    query: testCase.query,
    status: failureReasons.length === 0 ? "passed" : "failed",
    expectedWorkflowType: testCase.expectedWorkflowType,
    actualWorkflowType,
    expectedAuthorityClass: testCase.expectedAuthorityClass ?? null,
    actualAuthorityClass,
    failureReasons: [...new Set(failureReasons)],
  };
};

const summarize = (pack: DomainPack, cases: DomainPackEvalCaseResult[]): DomainPackEvalSummary => {
  const totalCases = cases.length;
  const passedCases = cases.filter((item) => item.status === "passed").length;
  const failedCases = totalCases - passedCases;
  return {
    domainPackId: pack.id,
    totalCases,
    passedCases,
    failedCases,
    passRate: totalCases === 0 ? 0 : passedCases / totalCases,
  };
};

export const evaluateDomainPack = (pack: DomainPack): DomainPackEvalResult => {
  const cases = pack.evaluationCases.map((testCase) => evaluateCase(pack, testCase));
  return { summary: summarize(pack, cases), cases };
};

export const evaluateDomainPacks = (packs: DomainPack[]): DomainPackEvalResult[] =>
  packs.map(evaluateDomainPack);

export const formatDomainPackEvalReport = (results: DomainPackEvalResult[]): string => {
  const totalCases = results.reduce((sum, result) => sum + result.summary.totalCases, 0);
  const passedCases = results.reduce((sum, result) => sum + result.summary.passedCases, 0);
  const failedCases = totalCases - passedCases;
  const passRate = totalCases === 0 ? 0 : passedCases / totalCases;

  return [
    "Domain pack eval report",
    `- packs: ${results.length}`,
    `- total: ${totalCases}`,
    `- passed: ${passedCases}`,
    `- failed: ${failedCases}`,
    `- passRate: ${(passRate * 100).toFixed(2)}%`,
    "",
    "Packs",
    ...results.map(
      (result) =>
        `- ${result.summary.domainPackId}: passed=${result.summary.passedCases}/${result.summary.totalCases} passRate=${(result.summary.passRate * 100).toFixed(2)}%`
    ),
    "",
    "Cases",
    ...results.flatMap((result) =>
      result.cases.map(
        (item) =>
          `- ${item.domainPackId}/${item.id}: ${item.status} workflow=${item.actualWorkflowType ?? "none"} expected=${item.expectedWorkflowType} authority=${item.actualAuthorityClass ?? "none"} reasons=[${item.failureReasons.join(",")}]`
      )
    ),
  ].join("\n");
};
