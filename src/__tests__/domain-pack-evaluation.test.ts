import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateDomainPack,
  evaluateDomainPacks,
  formatDomainPackEvalReport,
} from "../domain/evaluation.js";
import { DOMAIN_PACKS } from "../domain/registry.js";
import { municipalAntiguaDomainPack } from "../domain/packs/municipal-antigua.js";
import type { DomainPack } from "../domain/types.js";

describe("domain pack evaluation harness", () => {
  it("passes all registered starter pack evaluation cases", () => {
    const results = evaluateDomainPacks(Object.values(DOMAIN_PACKS));

    assert.ok(results.length >= 5);
    assert.equal(results.reduce((sum, result) => sum + result.summary.failedCases, 0), 0);
    assert.match(formatDomainPackEvalReport(results), /Domain pack eval report/);
    assert.match(formatDomainPackEvalReport(results), /municipal-antigua\/mixco-external-reference: passed/);
  });

  it("detects workflow type mismatches", () => {
    const pack: DomainPack = {
      ...municipalAntiguaDomainPack,
      evaluationCases: [
        {
          id: "bad-workflow",
          query: "¿Qué hay que hacer para construir un estadio municipal?",
          expectedWorkflowType: "procurement",
          notes: "Intentional mismatch.",
        },
      ],
    };

    const result = evaluateDomainPack(pack);

    assert.equal(result.summary.failedCases, 1);
    assert.deepEqual(result.cases[0].failureReasons, ["workflow_type_mismatch"]);
  });

  it("detects source authority mismatches when expected authority is provided", () => {
    const pack: DomainPack = {
      ...municipalAntiguaDomainPack,
      evaluationCases: [
        {
          id: "bad-authority",
          query: "Usa el manual de Mixco para explicar contratación de obra",
          expectedWorkflowType: "procurement",
          expectedAuthorityClass: "municipal_manual",
          notes: "Intentional authority mismatch.",
        },
      ],
    };

    const result = evaluateDomainPack(pack);

    assert.equal(result.summary.failedCases, 1);
    assert.deepEqual(result.cases[0].failureReasons, ["source_authority_mismatch"]);
    assert.equal(result.cases[0].actualAuthorityClass, "external_reference");
  });

  it("formats stable aggregate metrics", () => {
    const result = evaluateDomainPack(municipalAntiguaDomainPack);
    const report = formatDomainPackEvalReport([result]);

    assert.match(report, /packs: 1/);
    assert.match(report, /failed: 0/);
    assert.match(report, /passRate: 100\.00%/);
  });
});
