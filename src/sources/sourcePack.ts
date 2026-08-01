export type SourcePackOrganizationType = "municipality" | "government_agency" | "enterprise" | "nonprofit";
export type SourcePackConnectorType = "static_document" | "html_page" | "json_catalog";
export type SourcePackRefreshCadence = "static" | "daily" | "weekly" | "monthly" | "quarterly" | "annual" | "on_demand";

export interface SourcePackRefreshPolicy {
  cadence: SourcePackRefreshCadence;
  maximumAgeDays?: number;
}

export interface SourcePackConnector {
  connectorId: string;
  type: SourcePackConnectorType;
  title: string;
  discoveryUrl: string;
  allowedHosts: string[];
  sourceInventoryIds: string[];
  coverageTags: string[];
  acceptedMediaTypes: string[];
  refresh: SourcePackRefreshPolicy;
  enabled: boolean;
}

export interface SourcePackManifest {
  schemaVersion: 1;
  packId: string;
  displayName: string;
  organizationType: SourcePackOrganizationType;
  isTemplate: boolean;
  jurisdiction: string;
  domainPackId?: string;
  allowedHosts: string[];
  requiredCoverageTags: string[];
  connectors: SourcePackConnector[];
}

export interface SourcePackValidationFailure {
  path: string;
  message: string;
}

export interface SourcePackValidationResult {
  valid: boolean;
  failures: SourcePackValidationFailure[];
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HOST = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const MEDIA_TYPE = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i;
const ORGANIZATION_TYPES: SourcePackOrganizationType[] = ["municipality", "government_agency", "enterprise", "nonprofit"];
const CONNECTOR_TYPES: SourcePackConnectorType[] = ["static_document", "html_page", "json_catalog"];
const CADENCES: SourcePackRefreshCadence[] = ["static", "daily", "weekly", "monthly", "quarterly", "annual", "on_demand"];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const nonEmptyStrings = (value: unknown, maximum = 64): value is string[] =>
  Array.isArray(value) && value.length <= maximum && value.every((entry) => typeof entry === "string" && entry.trim().length > 0);

const hasDuplicates = (values: string[]): boolean => new Set(values).size !== values.length;

const httpsUrl = (value: unknown): URL | null => {
  if (typeof value !== "string") return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const validateSourcePack = (value: unknown): SourcePackValidationResult => {
  const failures: SourcePackValidationFailure[] = [];
  const fail = (path: string, message: string): void => {
    failures.push({ path, message });
  };

  if (!isObject(value)) return { valid: false, failures: [{ path: "$", message: "Source pack must be an object." }] };
  if (value.schemaVersion !== 1) fail("schemaVersion", "schemaVersion must equal 1.");
  if (typeof value.packId !== "string" || !SLUG.test(value.packId)) fail("packId", "packId must be a lowercase slug.");
  if (typeof value.displayName !== "string" || !value.displayName.trim()) fail("displayName", "displayName is required.");
  if (!ORGANIZATION_TYPES.includes(value.organizationType as SourcePackOrganizationType)) fail("organizationType", "organizationType is invalid.");
  if (typeof value.isTemplate !== "boolean") fail("isTemplate", "isTemplate must be boolean.");
  if (typeof value.jurisdiction !== "string" || !value.jurisdiction.trim()) fail("jurisdiction", "jurisdiction is required.");
  if (value.domainPackId !== undefined && (typeof value.domainPackId !== "string" || !SLUG.test(value.domainPackId))) {
    fail("domainPackId", "domainPackId must be a lowercase slug when present.");
  }

  if (!nonEmptyStrings(value.allowedHosts)) {
    fail("allowedHosts", "allowedHosts must be a bounded non-empty string array.");
  } else {
    if (hasDuplicates(value.allowedHosts)) fail("allowedHosts", "allowedHosts must not contain duplicates.");
    value.allowedHosts.forEach((host, index) => {
      if (!HOST.test(host)) fail(`allowedHosts[${index}]`, "Host is invalid.");
    });
  }

  if (!nonEmptyStrings(value.requiredCoverageTags)) {
    fail("requiredCoverageTags", "requiredCoverageTags must be a bounded non-empty string array.");
  } else {
    if (hasDuplicates(value.requiredCoverageTags)) fail("requiredCoverageTags", "Coverage tags must be unique.");
    value.requiredCoverageTags.forEach((tag, index) => {
      if (!SLUG.test(tag)) fail(`requiredCoverageTags[${index}]`, "Coverage tag must be a lowercase slug.");
    });
  }

  if (!Array.isArray(value.connectors) || value.connectors.length > 64) {
    fail("connectors", "connectors must be an array with at most 64 entries.");
  } else {
    if (value.isTemplate !== true && value.connectors.length === 0) fail("connectors", "A non-template pack needs at least one connector.");
    const ids: string[] = [];
    value.connectors.forEach((raw, index) => {
      const path = `connectors[${index}]`;
      if (!isObject(raw)) {
        fail(path, "Connector must be an object.");
        return;
      }
      if (typeof raw.connectorId !== "string" || !SLUG.test(raw.connectorId)) fail(`${path}.connectorId`, "connectorId must be a lowercase slug.");
      else ids.push(raw.connectorId);
      if (!CONNECTOR_TYPES.includes(raw.type as SourcePackConnectorType)) fail(`${path}.type`, "Connector type is invalid.");
      if (typeof raw.title !== "string" || !raw.title.trim()) fail(`${path}.title`, "Connector title is required.");
      const url = httpsUrl(raw.discoveryUrl);
      if (!url) fail(`${path}.discoveryUrl`, "discoveryUrl must be HTTPS and contain no credentials.");
      if (!nonEmptyStrings(raw.allowedHosts)) fail(`${path}.allowedHosts`, "Connector allowedHosts must be non-empty.");
      else {
        raw.allowedHosts.forEach((host, hostIndex) => {
          if (!HOST.test(host)) fail(`${path}.allowedHosts[${hostIndex}]`, "Host is invalid.");
          if (nonEmptyStrings(value.allowedHosts) && !value.allowedHosts.includes(host)) fail(`${path}.allowedHosts[${hostIndex}]`, "Host must also be allowed by the pack.");
        });
        if (url && !raw.allowedHosts.includes(url.hostname)) fail(`${path}.discoveryUrl`, "URL host is not allowed by the connector.");
      }
      if (!nonEmptyStrings(raw.sourceInventoryIds, 128)) fail(`${path}.sourceInventoryIds`, "sourceInventoryIds must be a bounded string array.");
      if (!nonEmptyStrings(raw.coverageTags)) fail(`${path}.coverageTags`, "coverageTags must be non-empty.");
      else raw.coverageTags.forEach((tag, tagIndex) => {
        if (!SLUG.test(tag)) fail(`${path}.coverageTags[${tagIndex}]`, "Coverage tag must be a lowercase slug.");
      });
      if (!nonEmptyStrings(raw.acceptedMediaTypes)) fail(`${path}.acceptedMediaTypes`, "acceptedMediaTypes must be non-empty.");
      else raw.acceptedMediaTypes.forEach((mediaType, mediaIndex) => {
        if (!MEDIA_TYPE.test(mediaType)) fail(`${path}.acceptedMediaTypes[${mediaIndex}]`, "Media type is invalid.");
      });
      if (!isObject(raw.refresh) || !CADENCES.includes(raw.refresh.cadence as SourcePackRefreshCadence)) {
        fail(`${path}.refresh`, "Refresh policy is invalid.");
      } else if (raw.refresh.maximumAgeDays !== undefined && (
        !Number.isInteger(raw.refresh.maximumAgeDays) || Number(raw.refresh.maximumAgeDays) < 1 || Number(raw.refresh.maximumAgeDays) > 3650
      )) {
        fail(`${path}.refresh.maximumAgeDays`, "maximumAgeDays must be between 1 and 3650.");
      }
      if (typeof raw.enabled !== "boolean") fail(`${path}.enabled`, "enabled must be boolean.");
    });
    if (hasDuplicates(ids)) fail("connectors", "connectorId values must be unique.");
  }

  return { valid: failures.length === 0, failures };
};

export const parseSourcePack = (content: string): SourcePackManifest => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    throw new Error("Source pack contains invalid JSON.");
  }
  const validation = validateSourcePack(parsed);
  if (!validation.valid) {
    throw new Error(validation.failures.map((failure) => `${failure.path}: ${failure.message}`).join("\n"));
  }
  return parsed as SourcePackManifest;
};
