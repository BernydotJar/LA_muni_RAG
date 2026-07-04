export type RetrievalEvalExpectedStatus = "evidence_found" | "not_found";
export type RetrievalEvalFailureReason =
  | "expected_evidence_not_found"
  | "unexpected_evidence_found"
  | "retrieval_error"
  | "invalid_eval_case";

export interface RetrievalEvalExpectedEvidence {
  citationLabel?: string;
  sourceType?: string;
  documentTitle?: string;
  textIncludes?: string;
}

export interface RetrievalEvalCase {
  id: string;
  query: string;
  mode?: string;
  expectedStatus: RetrievalEvalExpectedStatus;
  expectedEvidence?: RetrievalEvalExpectedEvidence[];
  minimumMatches?: number;
  notes?: string;
}

export interface RetrievalEvalEvidence {
  citationLabel?: string | null;
  sourceType?: string | null;
  documentTitle?: string | null;
  text?: string | null;
  excerpt?: string | null;
}

export interface RetrievalEvalRetrieverOptions {
  mode?: string;
  limit?: number;
}

export type RetrievalEvalRetriever = (
  query: string,
  options: RetrievalEvalRetrieverOptions
) => Promise<RetrievalEvalEvidence[]>;

export interface RetrievalEvalCaseResult {
  id: string;
  query: string;
  status: "passed" | "failed";
  expectedStatus: RetrievalEvalExpectedStatus;
  evidenceReturned: number;
  matches: number;
  expectedMatches: number;
  failureReasons: RetrievalEvalFailureReason[];
}

export interface RetrievalEvalSummary {
  totalCases: number;
  passedCases: number;
  failedCases: number;
  passRate: number;
  evidenceCases: number;
  notFoundCases: number;
  averageMatches: number;
}

export interface RetrievalEvalResult {
  summary: RetrievalEvalSummary;
  cases: RetrievalEvalCaseResult[];
}

const unique = <T>(values: T[]): T[] => [...new Set(values)];
const value = (input: string | null | undefined): string => input ?? "";
const combinedText = (item: RetrievalEvalEvidence): string => `${value(item.text)}\n${value(item.excerpt)}`;
const fieldMatches = (expected: string | undefined, actual: string | null | undefined): boolean =>
  expected === undefined || actual === expected;

export const matchesExpectedEvidence = (
  expected: RetrievalEvalExpectedEvidence,
  item: RetrievalEvalEvidence
): boolean =>
  fieldMatches(expected.citationLabel, item.citationLabel) &&
  fieldMatches(expected.sourceType, item.sourceType) &&
  fieldMatches(expected.documentTitle, item.documentTitle) &&
  (expected.textIncludes === undefined || combinedText(item).includes(expected.textIncludes));

const expectedMatchesForCase = (testCase: RetrievalEvalCase): number =>
  testCase.minimumMatches ?? testCase.expectedEvidence?.length ?? 0;

const validateCase = (testCase: RetrievalEvalCase): RetrievalEvalFailureReason[] => {
  const reasons: RetrievalEvalFailureReason[] = [];
  if (!testCase.id.trim()) reasons.push("invalid_eval_case");
  if (!testCase.query.trim()) reasons.push("invalid_eval_case");
  if (testCase.expectedStatus === "evidence_found" && expectedMatchesForCase(testCase) <= 0) {
    reasons.push("invalid_eval_case");
  }
  return unique(reasons);
};

const countMatches = (expected: RetrievalEvalExpectedEvidence[], evidence: RetrievalEvalEvidence[]): number =>
  expected.filter((expectedItem) => evidence.some((item) => matchesExpectedEvidence(expectedItem, item))).length;

const caseResult = (
  testCase: RetrievalEvalCase,
  status: "passed" | "failed",
  evidenceReturned: number,
  matches: number,
  reasons: RetrievalEvalFailureReason[]
): RetrievalEvalCaseResult => ({
  id: testCase.id,
  query: testCase.query,
  status,
  expectedStatus: testCase.expectedStatus,
  evidenceReturned,
  matches,
  expectedMatches: expectedMatchesForCase(testCase),
  failureReasons: unique(reasons),
});

const retrievalOptionsForCase = (testCase: RetrievalEvalCase, limit: number): RetrievalEvalRetrieverOptions => {
  const options: RetrievalEvalRetrieverOptions = { limit };
  if (testCase.mode !== undefined) options.mode = testCase.mode;
  return options;
};

export const evaluateRetrievalCase = async (
  testCase: RetrievalEvalCase,
  retriever: RetrievalEvalRetriever,
  limit = 5
): Promise<RetrievalEvalCaseResult> => {
  const validationReasons = validateCase(testCase);
  if (validationReasons.length > 0) return caseResult(testCase, "failed", 0, 0, validationReasons);

  let evidence: RetrievalEvalEvidence[];
  try {
    evidence = await retriever(testCase.query, retrievalOptionsForCase(testCase, limit));
  } catch {
    return caseResult(testCase, "failed", 0, 0, ["retrieval_error"]);
  }

  if (testCase.expectedStatus === "not_found") {
    return evidence.length === 0
      ? caseResult(testCase, "passed", 0, 0, [])
      : caseResult(testCase, "failed", evidence.length, 0, ["unexpected_evidence_found"]);
  }

  const matches = countMatches(testCase.expectedEvidence ?? [], evidence);
  const passed = matches >= expectedMatchesForCase(testCase);
  return caseResult(testCase, passed ? "passed" : "failed", evidence.length, matches, passed ? [] : ["expected_evidence_not_found"]);
};

const summarize = (cases: RetrievalEvalCaseResult[]): RetrievalEvalSummary => {
  const totalCases = cases.length;
  const passedCases = cases.filter((item) => item.status === "passed").length;
  const failedCases = totalCases - passedCases;
  const evidenceCases = cases.filter((item) => item.expectedStatus === "evidence_found").length;
  const notFoundCases = cases.filter((item) => item.expectedStatus === "not_found").length;
  const totalMatches = cases.reduce((sum, item) => sum + item.matches, 0);
  return {
    totalCases,
    passedCases,
    failedCases,
    passRate: totalCases === 0 ? 0 : passedCases / totalCases,
    evidenceCases,
    notFoundCases,
    averageMatches: totalCases === 0 ? 0 : totalMatches / totalCases,
  };
};

export const runRetrievalEval = async (
  cases: RetrievalEvalCase[],
  options: { retriever: RetrievalEvalRetriever; limit?: number }
): Promise<RetrievalEvalResult> => {
  const results: RetrievalEvalCaseResult[] = [];
  for (const testCase of cases) {
    results.push(await evaluateRetrievalCase(testCase, options.retriever, options.limit));
  }
  return { summary: summarize(results), cases: results };
};

export const formatRetrievalEvalReport = (result: RetrievalEvalResult): string =>
  [
    "Retrieval eval report",
    `- total: ${result.summary.totalCases}`,
    `- passed: ${result.summary.passedCases}`,
    `- failed: ${result.summary.failedCases}`,
    `- passRate: ${(result.summary.passRate * 100).toFixed(2)}%`,
    `- evidenceCases: ${result.summary.evidenceCases}`,
    `- notFoundCases: ${result.summary.notFoundCases}`,
    `- averageMatches: ${result.summary.averageMatches.toFixed(2)}`,
    "",
    "Cases",
    ...result.cases.map(
      (item) =>
        `- ${item.id}: ${item.status} matches=${item.matches} expected=${item.expectedMatches} reasons=[${item.failureReasons.join(",")}]`
    ),
  ].join("\n");
