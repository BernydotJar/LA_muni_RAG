import type { SourcePackManifest, SourcePackOrganizationType } from "../sources/sourcePack.js";

export interface TenantKnowledgeBranding {
  productName: string;
  assistantName: string;
  organizationName: string;
  primaryLabel: string;
}

export interface TenantKnowledgeProfile {
  schemaVersion: 1;
  profileId: string;
  displayName: string;
  organizationType: SourcePackOrganizationType;
  isTemplate: boolean;
  jurisdiction: string;
  language: string;
  domainPackId: string;
  sourcePackIds: string[];
  publicAccess: boolean;
  branding: TenantKnowledgeBranding;
}

export interface TenantKnowledgeProfileValidationFailure {
  path: string;
  message: string;
}

export interface TenantKnowledgeProfileValidationResult {
  valid: boolean;
  failures: TenantKnowledgeProfileValidationFailure[];
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LANGUAGE = /^[a-z]{2}(?:-[A-Z]{2})?$/;
const ORGANIZATION_TYPES: SourcePackOrganizationType[] = ["municipality", "government_agency", "enterprise", "nonprofit"];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const nonEmpty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

export const validateTenantKnowledgeProfile = (
  value: unknown,
  sourcePacks: ReadonlyMap<string, SourcePackManifest>
): TenantKnowledgeProfileValidationResult => {
  const failures: TenantKnowledgeProfileValidationFailure[] = [];
  const fail = (path: string, message: string): void => { failures.push({ path, message }); };

  if (!isObject(value)) return { valid: false, failures: [{ path: "$", message: "Tenant knowledge profile must be an object." }] };
  if (value.schemaVersion !== 1) fail("schemaVersion", "schemaVersion must equal 1.");
  if (!nonEmpty(value.profileId) || !SLUG.test(value.profileId)) fail("profileId", "profileId must be a lowercase slug.");
  if (!nonEmpty(value.displayName)) fail("displayName", "displayName is required.");
  if (!ORGANIZATION_TYPES.includes(value.organizationType as SourcePackOrganizationType)) fail("organizationType", "organizationType is invalid.");
  if (typeof value.isTemplate !== "boolean") fail("isTemplate", "isTemplate must be boolean.");
  if (!nonEmpty(value.jurisdiction)) fail("jurisdiction", "jurisdiction is required.");
  if (!nonEmpty(value.language) || !LANGUAGE.test(value.language)) fail("language", "language must use a supported language tag such as es or es-GT.");
  if (!nonEmpty(value.domainPackId) || !SLUG.test(value.domainPackId)) fail("domainPackId", "domainPackId must be a lowercase slug.");
  if (typeof value.publicAccess !== "boolean") fail("publicAccess", "publicAccess must be boolean.");

  if (!Array.isArray(value.sourcePackIds) || value.sourcePackIds.length === 0 || value.sourcePackIds.length > 16) {
    fail("sourcePackIds", "sourcePackIds must contain between 1 and 16 source-pack identifiers.");
  } else {
    const ids = value.sourcePackIds.filter((item): item is string => typeof item === "string");
    if (ids.length !== value.sourcePackIds.length || ids.some((id) => !SLUG.test(id))) {
      fail("sourcePackIds", "Every source-pack identifier must be a lowercase slug.");
    }
    if (new Set(ids).size !== ids.length) fail("sourcePackIds", "sourcePackIds must be unique.");
    for (const [index, id] of ids.entries()) {
      const pack = sourcePacks.get(id);
      if (!pack) {
        fail(`sourcePackIds[${index}]`, `Unknown source pack: ${id}.`);
        continue;
      }
      if (value.isTemplate !== true && pack.isTemplate) {
        fail(`sourcePackIds[${index}]`, `Production tenant profiles cannot reference template-only source pack ${id}.`);
      }
      if (pack.domainPackId && pack.domainPackId !== value.domainPackId) {
        fail(`sourcePackIds[${index}]`, `Source pack ${id} requires domain pack ${pack.domainPackId}.`);
      }
    }
  }

  if (!isObject(value.branding)) {
    fail("branding", "branding must be an object.");
  } else {
    for (const field of ["productName", "assistantName", "organizationName", "primaryLabel"] as const) {
      if (!nonEmpty(value.branding[field])) fail(`branding.${field}`, `${field} is required.`);
    }
  }

  return { valid: failures.length === 0, failures };
};

export const parseTenantKnowledgeProfile = (
  content: string,
  sourcePacks: ReadonlyMap<string, SourcePackManifest>
): TenantKnowledgeProfile => {
  let parsed: unknown;
  try { parsed = JSON.parse(content) as unknown; }
  catch { throw new Error("Tenant knowledge profile contains invalid JSON."); }
  const validation = validateTenantKnowledgeProfile(parsed, sourcePacks);
  if (!validation.valid) {
    throw new Error(validation.failures.map((failure) => `${failure.path}: ${failure.message}`).join("\n"));
  }
  return parsed as TenantKnowledgeProfile;
};
