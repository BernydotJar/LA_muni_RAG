import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { randomOpaqueToken } from "./crypto.js";
import { handleHumanSessionBff } from "./handler.js";
import { PostgresHumanSessionRepository } from "./repository.js";
import { NoopHumanSessionTelemetry } from "./telemetry.js";
import type {
  HumanSessionBffDependencies,
  HumanSessionBffOptions,
} from "./types.js";

const localhost = (hostname: string): boolean =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

const normalizeOrigin = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined || value.trim() === "") return null;
  const parsed = new URL(value.trim());
  if (
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash ||
    parsed.username ||
    parsed.password ||
    (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && localhost(parsed.hostname)))
  ) {
    throw new Error("Human session publicOrigin must be an exact HTTPS origin outside localhost");
  }
  return parsed.origin;
};

const boundedInteger = (
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string
): number => {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < minimum || resolved > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return resolved;
};

const normalizeReturnPaths = (values: readonly string[] | undefined): readonly string[] => {
  const paths = values ?? ["/", "/app"];
  if (paths.length < 1 || paths.length > 16) throw new Error("Human session return paths are invalid");
  const normalized = paths.map((path) => {
    if (
      path.length < 1 ||
      path.length > 200 ||
      !path.startsWith("/") ||
      path.startsWith("//") ||
      path.includes("?") ||
      path.includes("#") ||
      /[\u0000-\u001f\u007f]/.test(path)
    ) {
      throw new Error("Human session return path is invalid");
    }
    return path;
  });
  return Object.freeze([...new Set(normalized)]);
};

export const createHumanSessionBffDependencies = (
  options: HumanSessionBffOptions = {}
): HumanSessionBffDependencies => {
  const enabled = options.enabled ?? false;
  const approvedProvider = options.approvedProvider ?? false;
  const provider = options.provider ?? null;
  const publicOrigin = normalizeOrigin(options.publicOrigin);
  const allowedReturnPaths = normalizeReturnPaths(options.allowedReturnPaths);
  const loginTtlSeconds = boundedInteger(
    options.loginTtlSeconds,
    300,
    60,
    600,
    "Human session loginTtlSeconds"
  );
  const sessionTtlSeconds = boundedInteger(
    options.sessionTtlSeconds,
    8 * 60 * 60,
    300,
    8 * 60 * 60,
    "Human session sessionTtlSeconds"
  );
  const authorizationCodeReplayTtlSeconds = boundedInteger(
    options.authorizationCodeReplayTtlSeconds,
    10 * 60,
    60,
    60 * 60,
    "Human session authorizationCodeReplayTtlSeconds"
  );
  const secureCookies = Boolean(publicOrigin && new URL(publicOrigin).protocol === "https:");
  const sessionCookieName = secureCookies
    ? "__Host-la_muni_session"
    : "la_muni_session";
  const loginCookieName = secureCookies
    ? "__Host-la_muni_login"
    : "la_muni_login";
  const protector = options.protector ?? null;
  const repository = options.repository ?? (enabled ? new PostgresHumanSessionRepository() : null);

  if (enabled) {
    if (!approvedProvider) throw new Error("Human session provider must be explicitly approved");
    if (!provider) throw new Error("Human session provider adapter is required when enabled");
    if (!publicOrigin) throw new Error("Human session publicOrigin is required when enabled");
    if (!protector) throw new Error("Human session secret protector is required when enabled");
    if (!repository) throw new Error("Human session repository is required when enabled");
    if (process.env.NODE_ENV === "production" && provider.kind === "test") {
      throw new Error("Test human identity provider is forbidden in production");
    }
    if (process.env.NODE_ENV === "production" && protector.kind === "test-only") {
      throw new Error("Test human session protector is forbidden in production");
    }
  }

  return {
    enabled,
    approvedProvider,
    provider,
    repository,
    protector,
    publicOrigin,
    allowedReturnPaths,
    loginTtlSeconds,
    sessionTtlSeconds,
    authorizationCodeReplayTtlSeconds,
    secureCookies,
    sessionCookieName,
    loginCookieName,
    now: options.now ?? (() => new Date()),
    randomOpaque: options.randomOpaque ?? randomOpaqueToken,
    createUuid: options.createUuid ?? randomUUID,
    monotonicNow: options.monotonicNow ?? (() => performance.now()),
    telemetry: options.telemetry ?? new NoopHumanSessionTelemetry(),
  };
};

export {
  AesGcmSecretProtector,
  DeterministicTestSecretProtector,
  digestsEqual,
  pkceChallenge,
  randomOpaqueToken,
  sha256Hex,
} from "./crypto.js";
export {
  handleHumanSessionBff,
  HUMAN_CALLBACK_ROUTE,
  HUMAN_LOGIN_ROUTE,
  HUMAN_LOGOUT_ROUTE,
  HUMAN_SESSION_ROTATE_ROUTE,
  HUMAN_SESSION_ROUTE,
} from "./handler.js";
export {
  InMemoryHumanSessionRepository,
  PostgresHumanSessionRepository,
} from "./repository.js";
export { DeterministicHumanIdentityProvider } from "./testAdapter.js";
export * from "./types.js";

export {
  InMemoryHumanSessionTelemetry,
  NoopHumanSessionTelemetry,
  type HumanSessionTelemetrySummary,
} from "./telemetry.js";
