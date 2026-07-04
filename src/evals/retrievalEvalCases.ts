import type { RetrievalEvalCase } from "./retrievalEval.js";

export const sampleRetrievalEvalCases: RetrievalEvalCase[] = [
  {
    id: "municipal-citation-basic",
    query: "competencias municipales",
    mode: "hybrid",
    expectedStatus: "evidence_found",
    expectedEvidence: [
      {
        citationLabel: "Código Municipal Art. 68",
        documentTitle: "Código Municipal",
        textIncludes: "competencias propias del municipio",
      },
    ],
    notes: "Synthetic example showing a citation-bearing expected evidence check.",
  },
  {
    id: "unsupported-topic-not-found",
    query: "tema fuera del corpus municipal",
    mode: "hybrid",
    expectedStatus: "not_found",
    notes: "Synthetic not_found example for unsupported corpus topics.",
  },
];
