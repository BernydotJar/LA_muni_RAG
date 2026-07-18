import type { EvidenceItem } from "../evidence.js";
import type { ProcedureCitation, SourceAuthorityClass } from "./types.js";
import { loadDomainPack } from "../domain/registry.js";
import type { DomainPack, DomainSourceAuthority } from "../domain/types.js";

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const includesAny = (value: string, terms: string[]): boolean => terms.some((term) => value.includes(term));

const identifiesExternalMunicipality = (value: string): boolean => {
  const title = normalize(value);
  const match = title.match(/municipalidad de ([a-z ]+)/);
  if (!match) return false;
  const municipality = match[1]?.trim() ?? "";
  return municipality.length > 0 && municipality !== "la antigua guatemala" && municipality !== "antigua guatemala";
};

const externalReferenceAuthority = (domainPack: DomainPack): DomainSourceAuthority | undefined =>
  domainPack.sourceAuthorityClasses.find(
    (authority) => authority.externalReference || authority.authorityLevel === "comparative"
  );

export const resolveSourceAuthority = (
  evidence: EvidenceItem,
  domainPack: DomainPack = loadDomainPack(undefined)
): DomainSourceAuthority | undefined => {
  const type = normalize(evidence.sourceType || "");
  const title = normalize(`${evidence.documentTitle} ${evidence.citationLabel}`);

  if (identifiesExternalMunicipality(title)) {
    return externalReferenceAuthority(domainPack);
  }

  return domainPack.sourceAuthorityClasses.find((candidate) =>
    includesAny(title, candidate.titleKeywords.map((keyword) => normalize(keyword))) ||
    candidate.sourceTypes.map((sourceType) => normalize(sourceType)).includes(type)
  );
};

export const classifySourceAuthority = (
  evidence: EvidenceItem,
  domainPack: DomainPack = loadDomainPack(undefined)
): SourceAuthorityClass => resolveSourceAuthority(evidence, domainPack)?.id ?? "unknown";

export const hasLocalEvidence = (
  citations: ProcedureCitation[],
  domainPack: DomainPack = loadDomainPack(undefined)
): boolean =>
  citations.some((citation) => {
    const authority = domainPack.sourceAuthorityClasses.find((item) => item.id === citation.authorityClass);
    return Boolean(authority && authority.authorityLevel === "primary" && !authority.externalReference);
  });

export const hasAntiguaEvidence = hasLocalEvidence;

export const toProcedureCitation = (
  evidence: EvidenceItem,
  evidenceUse: ProcedureCitation["evidenceUse"] = "cited_text",
  domainPack: DomainPack = loadDomainPack(undefined)
): ProcedureCitation => {
  const authority = resolveSourceAuthority(evidence, domainPack);
  return {
    citationLabel: evidence.citationLabel,
    sourceType: evidence.sourceType,
    pageStart: evidence.pageStart,
    excerpt: evidence.excerpt.length > 360 ? `${evidence.excerpt.slice(0, 360)}…` : evidence.excerpt,
    sourceUrl: evidence.sourceUrl ?? null,
    authorityClass: authority?.id ?? "unknown",
    authorityLabel: authority?.label ?? "Fuente no clasificada",
    authorityLevel: authority?.authorityLevel ?? "unknown",
    evidenceUse,
  };
};
