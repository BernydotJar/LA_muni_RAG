import type { ProcedureQueryRequestV1 } from "./types.js";

export type ProductBoundaryViolation = "electoral_strategy" | "content_generation" | null;

const normalize = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const ELECTORAL_STRATEGY_PATTERNS = [
  /\bestrategia electoral\b/,
  /\belectoral strategy\b/,
  /\bsegmentacion (?:de )?(?:votantes|electoral)\b/,
  /\b(?:persuasion|movilizacion) (?:de votantes|electoral)\b/,
  /\bprioriza(?:r)? comunidades\b.{0,80}\bmovilizacion\b/,
  /\b(?:persuadir|convencer|influenciar) (?:a |al |a los )?(?:electores|votantes)\b/,
  /\bmicrotarget(?:ing)?\b/,
  /\bmensaj(?:e|eria)s? electoral(?:es)?\b/,
  /\bopositor(?:es|as)? polit(?:ico|ica|icos|icas)\b/,
  /\bvote(?:r)? targeting\b/,
];

const CONTENT_PATTERNS = [
  /\bcalendario (?:editorial|de contenido|de publicaciones)\b/,
  /\b(?:content|social media) calendar\b/,
  /\b(?:genera|generar|redacta|redactar|crea|crear|produce|producir)\b.{0,80}\b(?:contenido|publicacion|post|discurso|guion|copy|video)\b/,
  /\b(?:write|generate|create|draft)\b.{0,80}\b(?:content|post|speech|script|copy|video)\b/,
];

export const detectProductBoundaryViolation = (
  request: ProcedureQueryRequestV1
): ProductBoundaryViolation => {
  const text = normalize(
    [
      request.question,
      ...request.case_context.facts,
      ...request.case_context.constraints,
    ].join(" ")
  );
  if (ELECTORAL_STRATEGY_PATTERNS.some((pattern) => pattern.test(text))) {
    return "electoral_strategy";
  }
  if (CONTENT_PATTERNS.some((pattern) => pattern.test(text))) {
    return "content_generation";
  }
  return null;
};
