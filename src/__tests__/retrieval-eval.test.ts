import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateRetrievalCase,
  matchesExpectedEvidence,
  type RetrievalEvalEvidence,
  type RetrievalEvalRetriever,
} from "../evals/retrievalEval.js";

const fixture: RetrievalEvalEvidence[] = [
  {
    citationLabel: "Doc A p. 1",
    sourceType: "plan",
    documentTitle: "Document A",
    excerpt: "Local services are described here.",
  },
  {
    citationLabel: "Doc B p. 2",
    sourceType: "report",
    documentTitle: "Document B",
    text: "Planning evidence is described here.",
  },
];

const retriever: RetrievalEvalRetriever = async (query) => (query.includes("empty topic") ? [] : fixture);

describe("retrieval eval harness", () => {
  it("matches expected evidence fields", () => {
    assert.equal(matchesExpectedEvidence({ citationLabel: "Doc A p. 1" }, fixture[0]), true);
    assert.equal(matchesExpectedEvidence({ documentTitle: "Document A" }, fixture[0]), true);
    assert.equal(matchesExpectedEvidence({ sourceType: "plan" }, fixture[0]), true);
    assert.equal(matchesExpectedEvidence({ textIncludes: "Local services" }, fixture[0]), true);
    assert.equal(matchesExpectedEvidence({ citationLabel: "Missing" }, fixture[0]), false);
  });

  it("passes and fails expected evidence cases", async () => {
    const passed = await evaluateRetrievalCase(
      {
        id: "basic-pass",
        query: "local services",
        expectedStatus: "evidence_found",
        expectedEvidence: [{ citationLabel: "Doc A p. 1" }],
      },
      retriever
    );
    const failed = await evaluateRetrievalCase(
      {
        id: "basic-fail",
        query: "local services",
        expectedStatus: "evidence_found",
        expectedEvidence: [{ citationLabel: "Missing" }],
      },
      retriever
    );

    assert.equal(passed.status, "passed");
    assert.equal(failed.status, "failed");
    assert.deepEqual(failed.failureReasons, ["expected_evidence_not_found"]);
  });

  it("passes and fails not_found cases", async () => {
    const passed = await evaluateRetrievalCase(
      { id: "empty-pass", query: "empty topic", expectedStatus: "not_found" },
      retriever
    );
    const failed = await evaluateRetrievalCase(
      { id: "empty-fail", query: "local services", expectedStatus: "not_found" },
      retriever
    );

    assert.equal(passed.status, "passed");
    assert.equal(failed.status, "failed");
    assert.deepEqual(failed.failureReasons, ["unexpected_evidence_found"]);
  });

  it("records retrieval errors and invalid cases", async () => {
    const errorCase = await evaluateRetrievalCase(
      { id: "error", query: "q", expectedStatus: "not_found" },
      async () => {
        throw new Error("retrieval failed");
      }
    );
    const invalidCase = await evaluateRetrievalCase(
      { id: "", query: "", expectedStatus: "evidence_found" },
      retriever
    );

    assert.deepEqual(errorCase.failureReasons, ["retrieval_error"]);
    assert.deepEqual(invalidCase.failureReasons, ["invalid_eval_case"]);
  });
});
