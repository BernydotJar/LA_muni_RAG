import { isCanonicalUuid } from "../../security/index.js";
import type { ScopedSearchResult } from "../../search.js";

const MARKER_PATTERN =
  / \[la-muni-rag-evidence:([0-9a-f-]{36}):([0-9a-f-]{36}):([0-9a-f-]{36})\]$/i;

export interface EvidenceIdentity {
  documentId: string;
  documentVersionId: string;
  sectionId: string;
}

export const bindCitationLabelToEvidenceIdentity = (
  label: string,
  identity: EvidenceIdentity
): string => {
  if (
    !isCanonicalUuid(identity.documentId) ||
    !isCanonicalUuid(identity.documentVersionId) ||
    !isCanonicalUuid(identity.sectionId)
  ) {
    return label;
  }
  return `${label} [la-muni-rag-evidence:${identity.documentId.toLowerCase()}:${identity.documentVersionId.toLowerCase()}:${identity.sectionId.toLowerCase()}]`;
};

/**
 * Carries exact row identity through the legacy workflow composer without
 * relying on non-unique citation labels, pages, excerpts, or URLs.
 */
export const bindScopedEvidenceRecord = <T extends ScopedSearchResult>(record: T): T => ({
  ...record,
  citationLabel: bindCitationLabelToEvidenceIdentity(record.citationLabel, {
    documentId: record.documentId ?? "",
    documentVersionId: record.documentVersionId ?? "",
    sectionId: record.sectionId ?? "",
  }),
}) as T;

export const evidenceIdentityFromCitationLabel = (
  label: string
): EvidenceIdentity | null => {
  const match = MARKER_PATTERN.exec(label);
  if (!match) return null;
  const [, documentId, documentVersionId, sectionId] = match;
  if (
    !isCanonicalUuid(documentId) ||
    !isCanonicalUuid(documentVersionId) ||
    !isCanonicalUuid(sectionId)
  ) {
    return null;
  }
  return {
    documentId: documentId.toLowerCase(),
    documentVersionId: documentVersionId.toLowerCase(),
    sectionId: sectionId.toLowerCase(),
  };
};
