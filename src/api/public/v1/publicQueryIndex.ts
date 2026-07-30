import { randomUUID } from "node:crypto";
import { pool } from "../../../db.js";
import { isCanonicalUuid, type TenantTransactionPool } from "../../../security/index.js";
import {
  PostgresSearchEvidenceRepository,
  type SearchEvidenceRepository,
} from "../../v1/searchEvidenceIndex.js";
import { loadPublicQueryValidators } from "./publicQueryContracts.js";
import { handlePublicQueryV1 } from "./publicQueryHandler.js";
import {
  InMemoryPublicQueryRepository,
  PostgresPublicQueryRepository,
} from "./publicQueryRepository.js";
import type {
  PublicQueryApiDependencies,
  PublicQueryRepository,
  PublicQueryValidators,
} from "./publicQueryTypes.js";

export * from "./publicQueryContracts.js";
export * from "./publicQueryHandler.js";
export * from "./publicQueryRepository.js";
export * from "./publicQueryTypes.js";

export interface PublicQueryV1Options {
  enabled?: boolean;
  tenantId?: string | null;
  jurisdiction?: string | null;
  allowedOrigins?: readonly string[];
  clientKeySecret?: string | null;
  rateLimit?: number;
  globalRateLimit?: number;
  rateWindowSeconds?: number;
  maxLimit?: number;
  publicRepository?: PublicQueryRepository;
  searchRepository?: SearchEvidenceRepository;
  transactionPool?: TenantTransactionPool;
  validators?: Promise<PublicQueryValidators>;
  now?: () => Date;
  createUuid?: () => string;
}

const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;
const integerWithin = (value: unknown, minimum: number, maximum: number, fallback: number): number => {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new Error(`Public query numeric configuration must be between ${minimum} and ${maximum}`);
  }
  return Number(value);
};

const configuredBoolean = (value: string | undefined): boolean => value === "true";
const configuredInteger = (value: string | undefined): number | undefined => {
  if (value === undefined || value.trim() === "") return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error("Public query environment integer is invalid");
  return parsed;
};

const localhost = (hostname: string): boolean =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

const normalizeOrigins = (origins: readonly string[]): readonly string[] => {
  const normalized = origins.map((origin) => {
    const value = origin.trim();
    if (value.length < 1 || value.length > 300 || CONTROL_CHARACTER.test(value)) {
      throw new Error("Public query origin is invalid");
    }
    const parsed = new URL(value);
    if (parsed.pathname !== "/" || parsed.search || parsed.hash || parsed.username || parsed.password) {
      throw new Error("Public query origins must be exact scheme/host/port origins");
    }
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && localhost(parsed.hostname))) {
      throw new Error("Public query origins must use HTTPS outside localhost");
    }
    return parsed.origin;
  });
  return Object.freeze([...new Set(normalized)]);
};

const envOrigins = (): readonly string[] =>
  (process.env.PUBLIC_QUERY_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

export const createPublicQueryDependencies = (
  options: PublicQueryV1Options = {}
): PublicQueryApiDependencies => {
  const enabled = options.enabled ?? configuredBoolean(process.env.PUBLIC_QUERY_ENABLED);
  const tenantId = options.tenantId ?? process.env.PUBLIC_QUERY_TENANT_ID ?? null;
  const jurisdiction = options.jurisdiction ?? process.env.PUBLIC_QUERY_JURISDICTION ?? null;
  const allowedOrigins = normalizeOrigins(options.allowedOrigins ?? envOrigins());
  const clientKeySecret = options.clientKeySecret ?? process.env.PUBLIC_QUERY_RATE_LIMIT_SECRET ?? null;
  const rateLimit = integerWithin(
    options.rateLimit ?? configuredInteger(process.env.PUBLIC_QUERY_RATE_LIMIT),
    1,
    1000,
    20
  );
  const globalRateLimit = integerWithin(
    options.globalRateLimit ?? configuredInteger(process.env.PUBLIC_QUERY_GLOBAL_RATE_LIMIT),
    rateLimit,
    100000,
    Math.max(100, rateLimit)
  );
  const rateWindowSeconds = integerWithin(
    options.rateWindowSeconds ?? configuredInteger(process.env.PUBLIC_QUERY_RATE_WINDOW_SECONDS),
    10,
    3600,
    60
  );
  const maxLimit = integerWithin(
    options.maxLimit ?? configuredInteger(process.env.PUBLIC_QUERY_MAX_RESULTS),
    1,
    5,
    5
  );

  if (enabled) {
    if (!isCanonicalUuid(tenantId)) throw new Error("PUBLIC_QUERY_TENANT_ID must be a UUID when enabled");
    if (!jurisdiction || jurisdiction.length > 300 || CONTROL_CHARACTER.test(jurisdiction)) {
      throw new Error("PUBLIC_QUERY_JURISDICTION is required and bounded when enabled");
    }
    if (allowedOrigins.length < 1) throw new Error("PUBLIC_QUERY_ALLOWED_ORIGINS is required when enabled");
    if (!clientKeySecret || clientKeySecret.length < 32 || clientKeySecret.length > 512 || CONTROL_CHARACTER.test(clientKeySecret)) {
      throw new Error("PUBLIC_QUERY_RATE_LIMIT_SECRET must contain 32-512 safe characters when enabled");
    }
  }

  const transactionPool = options.transactionPool ?? pool;
  return {
    enabled,
    tenantId: isCanonicalUuid(tenantId) ? tenantId.toLowerCase() : null,
    jurisdiction: jurisdiction?.trim() || null,
    allowedOrigins,
    clientKeySecret,
    rateLimit,
    globalRateLimit,
    rateWindowSeconds,
    maxLimit,
    publicRepository: options.publicRepository ?? new PostgresPublicQueryRepository(),
    searchRepository: options.searchRepository ?? new PostgresSearchEvidenceRepository(transactionPool),
    transactionPool,
    validators: options.validators ?? loadPublicQueryValidators(),
    now: options.now ?? (() => new Date()),
    createUuid: options.createUuid ?? randomUUID,
  };
};

export {
  handlePublicQueryV1,
  InMemoryPublicQueryRepository,
  PostgresPublicQueryRepository,
};
