import type { EvidenceItem } from "../evidence.js";
import type { ProcedureCitation, SourceAuthorityClass } from "./types.js";
import { loadDomainPack } from "../domain/registry.js";
import type { DomainPack } from "../domain/types.js";

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const includesAny = (value: string, terms: string[]): boolean => terms.some((term) => value.includes(term));

export const classifySourceAuthority = (
  evidence: EvidenceItem,
  domainPack: DomainPack = loadDomainPack(undefined)
): SourceAuthorityClass => {
  const type = normalize(evidence.sourceType || "");
  const title = normalize(`${evidence.documentTitle} ${evidence.citationLabel}`);

  const authority = domainPack.sourceAuthorityClasses.find((candidate) =>
    includesAny(title, candidate.titleKeywords.map((keyword) => normalize(keyword))) ||
    candidate.sourceTypes.map((sourceType) => normalize(sourceType)).includes(type)
  );

  return authority?.id ?? "unknown";
};

export const hasLocalEvidence = (
  citations: ProcedureCitation[],
  domainPack: DomainPack = loadDomainPack(undefined)
): boolean =>
  citations.some((citation) => {
    const authority = domainPack.sourceAuthorityClasses.find((item) => item.id === citation.authorityClass);
    return authority && authority.authorityLevel !== "unknown" && !authority.externalReference;
  });

export const hasAntiguaEvidence = hasLocalEvidence;

export const toProcedureCitation = (
  evidence: EvidenceItem,
  evidenceUse: ProcedureCitation["evidenceUse"] = "cited_text",
  domainPack: DomainPack = loadDomainPack(undefined)
): ProcedureCitation => ({
  citationLabel: evidence.citationLabel,
  sourceType: evidence.sourceType,
  pageStart: evidence.pageStart,
  excerpt: evidence.excerpt.length > 360 ? `${evidence.excerpt.slice(0, 360)}…` : evidence.excerpt,
  sourceUrl: evidence.sourceUrl ?? null,
  authorityClass: classifySourceAuthority(evidence, domainPack),
  evidenceUse,
});
