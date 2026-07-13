import type { SourceFormat } from "../ingestion/types.js";
import { loadDomainPack } from "./registry.js";
import type { DomainDocumentConfidentiality, DomainDocumentMetadata, DomainPack } from "./types.js";

const confidentialityValues: DomainDocumentConfidentiality[] = ["public", "internal", "restricted"];

export interface DomainDocumentMetadataInput {
  domainPackId?: string;
  sourceAuthorityClass?: string;
  documentType?: string;
  jurisdiction?: string;
  organization?: string;
  confidentiality?: string;
  tags?: string[];
}

export class DomainDocumentMetadataError extends Error {
  readonly code = "invalid_domain_document_metadata";

  constructor(message: string) {
    super(message);
    this.name = "DomainDocumentMetadataError";
  }
}

const cleanOptional = (value: string | undefined): string | undefined => {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
};

const uniqueCleanTags = (tags: string[] | undefined): string[] | undefined => {
  const cleaned = [...new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean))];
  return cleaned.length > 0 ? cleaned : undefined;
};

const validateConfidentiality = (value: string | undefined): DomainDocumentConfidentiality | undefined => {
  const cleaned = cleanOptional(value);
  if (!cleaned) return undefined;
  if (confidentialityValues.includes(cleaned as DomainDocumentConfidentiality)) {
    return cleaned as DomainDocumentConfidentiality;
  }
  throw new DomainDocumentMetadataError(`Unsupported confidentiality: ${cleaned}`);
};

const validateAuthorityClass = (pack: DomainPack, value: string | undefined): string => {
  const authorityClass = cleanOptional(value) ?? "unknown";
  if (pack.sourceAuthorityClasses.some((authority) => authority.id === authorityClass)) return authorityClass;
  throw new DomainDocumentMetadataError(`Unsupported source authority class for ${pack.id}: ${authorityClass}`);
};

export const buildDomainDocumentMetadata = (
  input: DomainDocumentMetadataInput,
  sourceFormat: SourceFormat
): DomainDocumentMetadata => {
  const pack = loadDomainPack(input.domainPackId);
  const metadata: DomainDocumentMetadata = {
    domainPackId: pack.id,
    sourceAuthorityClass: validateAuthorityClass(pack, input.sourceAuthorityClass),
    documentType: cleanOptional(input.documentType) ?? sourceFormat,
  };

  const jurisdiction = cleanOptional(input.jurisdiction);
  const organization = cleanOptional(input.organization);
  const confidentiality = validateConfidentiality(input.confidentiality);
  const tags = uniqueCleanTags(input.tags);

  if (jurisdiction) metadata.jurisdiction = jurisdiction;
  if (organization) metadata.organization = organization;
  if (confidentiality) metadata.confidentiality = confidentiality;
  if (tags) metadata.tags = tags;

  return metadata;
};
