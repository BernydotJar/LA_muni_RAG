import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EvidenceItem } from "../evidence.js";
import {
  classifySourceAuthority,
  hasAntiguaEvidence,
  toProcedureCitation,
} from "../procedure/procedureAuthorities.js";

const evidence = (documentTitle: string, sourceType = "manual"): EvidenceItem => ({
  documentTitle,
  sourceType,
  citationLabel: `${documentTitle}, página 1`,
  pageStart: 1,
  excerpt: "Texto de prueba.",
  score: 1,
  retrievalMode: "keyword",
});

describe("Antigua authority boundaries", () => {
  it("does not count national law as Antigua municipal evidence", () => {
    const citation = toProcedureCitation(evidence("Ley de Contrataciones del Estado", "law"));

    assert.equal(citation.authorityLevel, "national");
    assert.equal(hasAntiguaEvidence([citation]), false);
  });

  it("keeps Mixco and Escuintla manuals comparative", () => {
    const mixco = evidence("Manual de adquisiciones Municipalidad de Mixco");
    const escuintla = evidence("Manual de adquisiciones Municipalidad de Escuintla");

    assert.equal(classifySourceAuthority(mixco), "external_reference");
    assert.equal(classifySourceAuthority(escuintla), "external_reference");
    assert.equal(toProcedureCitation(escuintla).authorityLevel, "comparative");
  });

  it("does not promote an explicitly named unknown municipality through generic manual keywords", () => {
    const external = evidence("Manual de procedimientos Municipalidad de San Ejemplo");
    assert.equal(classifySourceAuthority(external), "external_reference");
    assert.equal(hasAntiguaEvidence([toProcedureCitation(external)]), false);
  });

  it("still recognizes an Antigua municipal plan as primary", () => {
    const local = toProcedureCitation(evidence("PDM-OT Antigua Guatemala", "plan"));
    assert.equal(local.authorityLevel, "primary");
    assert.equal(hasAntiguaEvidence([local]), true);
  });
});
