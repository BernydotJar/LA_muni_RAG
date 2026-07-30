import { AesGcmSecretProtector } from "./crypto.js";
import {
  OIDC_ALLOWED_SIGNING_ALGORITHMS,
  OIDC_TOKEN_ENDPOINT_AUTH_METHODS,
  OidcHumanIdentityProvider,
  type OidcAllowedSigningAlgorithm,
  type OidcTokenEndpointAuthMethod,
} from "./oidcAdapter.js";
import type { HumanSessionBffOptions } from "./types.js";

const configuredBoolean = (value: string | undefined, name: string): boolean | undefined => {
  if (value === undefined || value.trim() === "") return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be exactly true or false`);
};

const required = (env: NodeJS.ProcessEnv, name: string): string => {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required when human sessions are enabled`);
  return value;
};

const optionalInteger = (value: string | undefined, name: string): number | undefined => {
  if (value === undefined || value.trim() === "") return undefined;
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be a positive integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${name} must be a safe integer`);
  return parsed;
};

const allowedAlgorithms = (value: string | undefined): readonly OidcAllowedSigningAlgorithm[] => {
  if (!value?.trim()) return ["RS256"];
  const values = [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
  if (
    values.length < 1 ||
    !values.every((item): item is OidcAllowedSigningAlgorithm =>
      OIDC_ALLOWED_SIGNING_ALGORITHMS.includes(item as OidcAllowedSigningAlgorithm)
    )
  ) {
    throw new Error("HUMAN_SESSION_OIDC_ALLOWED_ALGORITHMS contains an unsupported algorithm");
  }
  return Object.freeze(values);
};

const authMethod = (value: string | undefined): OidcTokenEndpointAuthMethod => {
  const resolved = value?.trim() || "client_secret_basic";
  if (!OIDC_TOKEN_ENDPOINT_AUTH_METHODS.includes(resolved as OidcTokenEndpointAuthMethod)) {
    throw new Error("HUMAN_SESSION_OIDC_TOKEN_AUTH_METHOD is unsupported");
  }
  return resolved as OidcTokenEndpointAuthMethod;
};

export const loadHumanSessionBffOptionsFromEnv = (
  env: NodeJS.ProcessEnv = process.env
): HumanSessionBffOptions => {
  const enabled = configuredBoolean(env.HUMAN_SESSION_ENABLED, "HUMAN_SESSION_ENABLED") ?? false;
  if (!enabled) return { enabled: false };
  if (configuredBoolean(env.HUMAN_SESSION_PROVIDER_APPROVED, "HUMAN_SESSION_PROVIDER_APPROVED") !== true) {
    throw new Error("HUMAN_SESSION_PROVIDER_APPROVED=true is required when human sessions are enabled");
  }
  const issuer = required(env, "HUMAN_SESSION_OIDC_ISSUER");
  const endpointOrigins = (env.HUMAN_SESSION_OIDC_ALLOWED_ENDPOINT_ORIGINS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const provider = new OidcHumanIdentityProvider({
    providerId: required(env, "HUMAN_SESSION_OIDC_PROVIDER_ID"),
    issuer,
    clientId: required(env, "HUMAN_SESSION_OIDC_CLIENT_ID"),
    clientSecret: required(env, "HUMAN_SESSION_OIDC_CLIENT_SECRET"),
    allowedEndpointOrigins: Object.freeze([...new Set([new URL(issuer).origin, ...endpointOrigins])]),
    allowedSigningAlgorithms: allowedAlgorithms(env.HUMAN_SESSION_OIDC_ALLOWED_ALGORITHMS),
    tokenEndpointAuthMethod: authMethod(env.HUMAN_SESSION_OIDC_TOKEN_AUTH_METHOD),
    requestTimeoutMs: optionalInteger(env.HUMAN_SESSION_OIDC_REQUEST_TIMEOUT_MS, "HUMAN_SESSION_OIDC_REQUEST_TIMEOUT_MS"),
    discoveryCacheTtlSeconds: optionalInteger(env.HUMAN_SESSION_OIDC_DISCOVERY_CACHE_SECONDS, "HUMAN_SESSION_OIDC_DISCOVERY_CACHE_SECONDS"),
    jwksCacheTtlSeconds: optionalInteger(env.HUMAN_SESSION_OIDC_JWKS_CACHE_SECONDS, "HUMAN_SESSION_OIDC_JWKS_CACHE_SECONDS"),
  });
  return {
    enabled: true,
    approvedProvider: true,
    provider,
    protector: new AesGcmSecretProtector(required(env, "HUMAN_SESSION_PROTECTOR_KEY_BASE64URL")),
    publicOrigin: required(env, "HUMAN_SESSION_PUBLIC_ORIGIN"),
    loginTtlSeconds: optionalInteger(env.HUMAN_SESSION_LOGIN_TTL_SECONDS, "HUMAN_SESSION_LOGIN_TTL_SECONDS"),
    sessionTtlSeconds: optionalInteger(env.HUMAN_SESSION_TTL_SECONDS, "HUMAN_SESSION_TTL_SECONDS"),
  };
};
