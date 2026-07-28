import {
  createLocalJWKSet,
  decodeProtectedHeader,
  jwtVerify,
  type JSONWebKeySet,
} from "jose";
import {
  HumanIdentityProviderAuthenticationError,
  HumanIdentityProviderUnavailableError,
} from "./providerErrors.js";
import type {
  HumanAuthorizationCodeExchange,
  HumanAuthorizationRequest,
  HumanIdentityProviderAdapter,
  HumanProviderIdentity,
} from "./types.js";

export const OIDC_ALLOWED_SIGNING_ALGORITHMS = ["RS256", "PS256", "ES256"] as const;
export type OidcAllowedSigningAlgorithm = (typeof OIDC_ALLOWED_SIGNING_ALGORITHMS)[number];

export const OIDC_TOKEN_ENDPOINT_AUTH_METHODS = [
  "client_secret_basic",
  "client_secret_post",
] as const;
export type OidcTokenEndpointAuthMethod = (typeof OIDC_TOKEN_ENDPOINT_AUTH_METHODS)[number];

interface OidcDiscoveryDocument {
  issuer: string;
  authorizationEndpoint: URL;
  tokenEndpoint: URL;
  jwksUri: URL;
  signingAlgorithms: readonly OidcAllowedSigningAlgorithm[];
}

interface CacheEntry<T> {
  value: T;
  expiresAtMs: number;
}

interface JwksCacheEntry extends CacheEntry<JSONWebKeySet> {
  uri: string;
}

export interface OidcHumanIdentityProviderOptions {
  providerId: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
  allowedEndpointOrigins?: readonly string[];
  allowedSigningAlgorithms?: readonly OidcAllowedSigningAlgorithm[];
  tokenEndpointAuthMethod?: OidcTokenEndpointAuthMethod;
  requestTimeoutMs?: number;
  maxResponseBytes?: number;
  discoveryCacheTtlSeconds?: number;
  jwksCacheTtlSeconds?: number;
  maxIdTokenLifetimeSeconds?: number;
  clockToleranceSeconds?: number;
  fetch?: typeof fetch;
  now?: () => Date;
}

const CONTROL = /[\u0000-\u001f\u007f]/;
const PROVIDER_ID = /^[a-z][a-z0-9-]{2,63}$/;
const OPAQUE = /^[A-Za-z0-9_-]{43,172}$/;
const AUTHORIZATION_CODE = /^[A-Za-z0-9._~-]{8,512}$/;
const JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const JSON_MEDIA = new Set(["application/json"]);
const JWKS_MEDIA = new Set(["application/json", "application/jwk-set+json"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

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

const normalizeIssuer = (value: string): string => {
  if (value.length < 8 || value.length > 500 || CONTROL.test(value)) {
    throw new Error("OIDC issuer is invalid");
  }
  const parsed = new URL(value);
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("OIDC issuer must be an exact HTTPS URI");
  }
  return parsed.href.replace(/\/$/, "");
};

const discoveryUrl = (issuer: string): URL => {
  const parsed = new URL(issuer);
  const issuerPath = parsed.pathname === "/" ? "" : parsed.pathname;
  return new URL(`${parsed.origin}/.well-known/openid-configuration${issuerPath}`);
};

const normalizeOrigin = (value: string): string => {
  const parsed = new URL(value);
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("OIDC endpoint origin must be an exact HTTPS origin");
  }
  return parsed.origin;
};

const normalizeEndpoint = (value: unknown, allowedOrigins: ReadonlySet<string>): URL => {
  if (typeof value !== "string" || value.length < 8 || value.length > 1000 || CONTROL.test(value)) {
    throw new HumanIdentityProviderUnavailableError();
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new HumanIdentityProviderUnavailableError();
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    !allowedOrigins.has(parsed.origin)
  ) {
    throw new HumanIdentityProviderUnavailableError();
  }
  return parsed;
};

const normalizeRedirectUri = (value: string): string => {
  const parsed = new URL(value);
  const loopback =
    parsed.protocol === "http:" &&
    ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if ((!loopback && parsed.protocol !== "https:") || parsed.username || parsed.password || parsed.hash) {
    throw new HumanIdentityProviderAuthenticationError();
  }
  return parsed.toString();
};

const stringArray = (value: unknown, maximum: number): readonly string[] | null => {
  if (!Array.isArray(value) || value.length < 1 || value.length > maximum) return null;
  if (!value.every((item) => typeof item === "string" && item.length > 0 && item.length <= 100)) {
    return null;
  }
  return Object.freeze([...new Set(value as string[])]);
};

const readBoundedJson = async (
  response: Response,
  maximumBytes: number,
  mediaTypes: ReadonlySet<string>
): Promise<Record<string, unknown>> => {
  const mediaType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (!mediaType || !mediaTypes.has(mediaType)) throw new HumanIdentityProviderUnavailableError();
  const declaredLength = response.headers.get("content-length");
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > maximumBytes) {
    throw new HumanIdentityProviderUnavailableError();
  }
  if (!response.body) throw new HumanIdentityProviderUnavailableError();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      total += item.value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw new HumanIdentityProviderUnavailableError();
      }
      chunks.push(item.value);
    }
  } finally {
    reader.releaseLock();
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8"));
  } catch {
    throw new HumanIdentityProviderUnavailableError();
  }
  if (!isRecord(value)) throw new HumanIdentityProviderUnavailableError();
  return value;
};

const validateJwks = (
  document: Record<string, unknown>,
  allowedAlgorithms: readonly OidcAllowedSigningAlgorithm[]
): JSONWebKeySet => {
  const keys = document.keys;
  if (!Array.isArray(keys) || keys.length < 1 || keys.length > 100) {
    throw new HumanIdentityProviderUnavailableError();
  }
  const keyIds = new Set<string>();
  for (const key of keys) {
    if (!isRecord(key)) throw new HumanIdentityProviderUnavailableError();
    if (
      (key.kty !== "RSA" && key.kty !== "EC") ||
      typeof key.kid !== "string" ||
      key.kid.length < 1 ||
      key.kid.length > 255 ||
      key.d !== undefined ||
      key.p !== undefined ||
      key.q !== undefined ||
      key.k !== undefined ||
      (key.alg !== undefined &&
        (typeof key.alg !== "string" ||
          !allowedAlgorithms.includes(key.alg as OidcAllowedSigningAlgorithm))) ||
      (key.use !== undefined && key.use !== "sig") ||
      (key.key_ops !== undefined && (!Array.isArray(key.key_ops) || !key.key_ops.includes("verify")))
    ) {
      throw new HumanIdentityProviderUnavailableError();
    }
    if (keyIds.has(key.kid)) throw new HumanIdentityProviderUnavailableError();
    keyIds.add(key.kid);
  }
  return { keys } as JSONWebKeySet;
};

const refreshableKeyError = (error: unknown): boolean =>
  isRecord(error) &&
  (error.code === "ERR_JWKS_NO_MATCHING_KEY" || error.code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED");

const formComponent = (value: string): string => {
  const encoded = new URLSearchParams([["value", value]]).toString();
  return encoded.slice("value=".length);
};

export class OidcHumanIdentityProvider implements HumanIdentityProviderAdapter {
  readonly kind = "oidc" as const;
  readonly providerId: string;

  readonly #issuer: string;
  readonly #clientId: string;
  readonly #clientSecret: string;
  readonly #allowedEndpointOrigins: ReadonlySet<string>;
  readonly #allowedSigningAlgorithms: readonly OidcAllowedSigningAlgorithm[];
  readonly #tokenEndpointAuthMethod: OidcTokenEndpointAuthMethod;
  readonly #requestTimeoutMs: number;
  readonly #maxResponseBytes: number;
  readonly #discoveryCacheTtlMs: number;
  readonly #jwksCacheTtlMs: number;
  readonly #maxIdTokenLifetimeSeconds: number;
  readonly #clockToleranceSeconds: number;
  readonly #fetch: typeof fetch;
  readonly #now: () => Date;
  #discoveryCache: CacheEntry<OidcDiscoveryDocument> | null = null;
  #jwksCache: JwksCacheEntry | null = null;

  constructor(options: OidcHumanIdentityProviderOptions) {
    if (!PROVIDER_ID.test(options.providerId)) throw new Error("OIDC providerId is invalid");
    if (options.clientId.length < 1 || options.clientId.length > 255 || CONTROL.test(options.clientId)) {
      throw new Error("OIDC clientId is invalid");
    }
    if (
      options.clientSecret.length < 16 ||
      options.clientSecret.length > 4096 ||
      CONTROL.test(options.clientSecret)
    ) {
      throw new Error("OIDC clientSecret is invalid");
    }
    const issuer = normalizeIssuer(options.issuer);
    const origins = options.allowedEndpointOrigins ?? [new URL(issuer).origin];
    if (origins.length < 1 || origins.length > 16) throw new Error("OIDC endpoint origins are invalid");
    const normalizedOrigins = new Set(origins.map(normalizeOrigin));
    normalizedOrigins.add(new URL(issuer).origin);
    const algorithms = options.allowedSigningAlgorithms ?? ["RS256"];
    if (
      algorithms.length < 1 ||
      algorithms.length > OIDC_ALLOWED_SIGNING_ALGORITHMS.length ||
      !algorithms.every((algorithm) => OIDC_ALLOWED_SIGNING_ALGORITHMS.includes(algorithm))
    ) {
      throw new Error("OIDC signing algorithm allowlist is invalid");
    }
    const authMethod = options.tokenEndpointAuthMethod ?? "client_secret_basic";
    if (!OIDC_TOKEN_ENDPOINT_AUTH_METHODS.includes(authMethod)) {
      throw new Error("OIDC token endpoint authentication method is invalid");
    }
    this.providerId = options.providerId;
    this.#issuer = issuer;
    this.#clientId = options.clientId;
    this.#clientSecret = options.clientSecret;
    this.#allowedEndpointOrigins = normalizedOrigins;
    this.#allowedSigningAlgorithms = Object.freeze([...new Set(algorithms)]);
    this.#tokenEndpointAuthMethod = authMethod;
    this.#requestTimeoutMs = boundedInteger(options.requestTimeoutMs, 5_000, 500, 15_000, "OIDC requestTimeoutMs");
    this.#maxResponseBytes = boundedInteger(options.maxResponseBytes, 32_768, 4_096, 65_536, "OIDC maxResponseBytes");
    this.#discoveryCacheTtlMs = boundedInteger(options.discoveryCacheTtlSeconds, 300, 60, 3_600, "OIDC discoveryCacheTtlSeconds") * 1000;
    this.#jwksCacheTtlMs = boundedInteger(options.jwksCacheTtlSeconds, 300, 60, 3_600, "OIDC jwksCacheTtlSeconds") * 1000;
    this.#maxIdTokenLifetimeSeconds = boundedInteger(options.maxIdTokenLifetimeSeconds, 3_600, 60, 3_600, "OIDC maxIdTokenLifetimeSeconds");
    this.#clockToleranceSeconds = boundedInteger(options.clockToleranceSeconds, 30, 0, 60, "OIDC clockToleranceSeconds");
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#now = options.now ?? (() => new Date());
  }

  async #request(url: URL, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#requestTimeoutMs);
    try {
      return await this.#fetch(url, { ...init, redirect: "error", signal: controller.signal });
    } catch {
      throw new HumanIdentityProviderUnavailableError();
    } finally {
      clearTimeout(timeout);
    }
  }

  async #loadDiscovery(): Promise<OidcDiscoveryDocument> {
    const cached = this.#discoveryCache;
    if (cached && cached.expiresAtMs > this.#now().getTime()) return cached.value;
    const response = await this.#request(discoveryUrl(this.#issuer), {
      method: "GET",
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new HumanIdentityProviderUnavailableError();
    const document = await readBoundedJson(response, this.#maxResponseBytes, JSON_MEDIA);
    if (document.issuer !== this.#issuer) throw new HumanIdentityProviderUnavailableError();
    const responseTypes = stringArray(document.response_types_supported, 32);
    const subjectTypes = stringArray(document.subject_types_supported, 8);
    const advertisedAlgorithms = stringArray(document.id_token_signing_alg_values_supported, 32);
    if (
      !responseTypes?.includes("code") ||
      !subjectTypes?.some((value) => value === "public" || value === "pairwise") ||
      !advertisedAlgorithms
    ) {
      throw new HumanIdentityProviderUnavailableError();
    }
    const signingAlgorithms = this.#allowedSigningAlgorithms.filter((algorithm) =>
      advertisedAlgorithms.includes(algorithm)
    );
    if (signingAlgorithms.length < 1) throw new HumanIdentityProviderUnavailableError();
    const challengeMethods = stringArray(document.code_challenge_methods_supported, 16);
    if (!challengeMethods?.includes("S256")) {
      throw new HumanIdentityProviderUnavailableError();
    }
    const tokenAuthMethods =
      document.token_endpoint_auth_methods_supported === undefined
        ? (["client_secret_basic"] as const)
        : stringArray(document.token_endpoint_auth_methods_supported, 16);
    if (!tokenAuthMethods?.includes(this.#tokenEndpointAuthMethod)) {
      throw new HumanIdentityProviderUnavailableError();
    }
    const value: OidcDiscoveryDocument = {
      issuer: this.#issuer,
      authorizationEndpoint: normalizeEndpoint(document.authorization_endpoint, this.#allowedEndpointOrigins),
      tokenEndpoint: normalizeEndpoint(document.token_endpoint, this.#allowedEndpointOrigins),
      jwksUri: normalizeEndpoint(document.jwks_uri, this.#allowedEndpointOrigins),
      signingAlgorithms: Object.freeze(signingAlgorithms),
    };
    this.#discoveryCache = { value, expiresAtMs: this.#now().getTime() + this.#discoveryCacheTtlMs };
    return value;
  }

  async #loadJwks(uri: URL, forceRefresh = false): Promise<JSONWebKeySet> {
    const cached = this.#jwksCache;
    if (
      !forceRefresh &&
      cached &&
      cached.uri === uri.toString() &&
      cached.expiresAtMs > this.#now().getTime()
    ) {
      return cached.value;
    }
    const response = await this.#request(uri, {
      method: "GET",
      headers: { accept: "application/jwk-set+json, application/json" },
    });
    if (!response.ok) throw new HumanIdentityProviderUnavailableError();
    const value = validateJwks(
      await readBoundedJson(response, this.#maxResponseBytes, JWKS_MEDIA),
      this.#allowedSigningAlgorithms
    );
    this.#jwksCache = {
      value,
      uri: uri.toString(),
      expiresAtMs: this.#now().getTime() + this.#jwksCacheTtlMs,
    };
    return value;
  }

  async buildAuthorizationUrl(request: HumanAuthorizationRequest): Promise<URL> {
    if (!OPAQUE.test(request.state) || !OPAQUE.test(request.nonce) || !OPAQUE.test(request.codeChallenge)) {
      throw new HumanIdentityProviderAuthenticationError();
    }
    const discovery = await this.#loadDiscovery();
    const url = new URL(discovery.authorizationEndpoint);
    url.searchParams.set("client_id", this.#clientId);
    url.searchParams.set("redirect_uri", normalizeRedirectUri(request.redirectUri));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid");
    url.searchParams.set("state", request.state);
    url.searchParams.set("nonce", request.nonce);
    url.searchParams.set("code_challenge", request.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    return url;
  }

  async #verifyIdToken(
    idToken: string,
    discovery: OidcDiscoveryDocument,
    forceKeyRefresh: boolean
  ): Promise<HumanProviderIdentity> {
    let header: Record<string, unknown>;
    try {
      header = decodeProtectedHeader(idToken) as Record<string, unknown>;
    } catch {
      throw new HumanIdentityProviderAuthenticationError();
    }
    if (
      typeof header.alg !== "string" ||
      !discovery.signingAlgorithms.includes(header.alg as OidcAllowedSigningAlgorithm) ||
      typeof header.kid !== "string" ||
      header.kid.length < 1 ||
      header.kid.length > 255 ||
      header.jku !== undefined ||
      header.x5u !== undefined ||
      header.jwk !== undefined ||
      header.crit !== undefined ||
      (header.typ !== undefined && header.typ !== "JWT")
    ) {
      throw new HumanIdentityProviderAuthenticationError();
    }
    const keySet = createLocalJWKSet(await this.#loadJwks(discovery.jwksUri, forceKeyRefresh));
    const { payload } = await jwtVerify(idToken, keySet, {
      issuer: discovery.issuer,
      audience: this.#clientId,
      algorithms: [...discovery.signingAlgorithms],
      clockTolerance: this.#clockToleranceSeconds,
      currentDate: this.#now(),
      requiredClaims: ["iss", "sub", "aud", "exp", "iat", "nonce"],
    });
    const audiences = typeof payload.aud === "string" ? [payload.aud] : payload.aud;
    if (!audiences || audiences.length < 1 || !audiences.includes(this.#clientId)) {
      throw new HumanIdentityProviderAuthenticationError();
    }
    if (
      (audiences.length > 1 && payload.azp !== this.#clientId) ||
      (payload.azp !== undefined && payload.azp !== this.#clientId)
    ) {
      throw new HumanIdentityProviderAuthenticationError();
    }
    if (
      typeof payload.sub !== "string" ||
      payload.sub.length < 1 ||
      payload.sub.length > 255 ||
      CONTROL.test(payload.sub) ||
      typeof payload.nonce !== "string" ||
      !OPAQUE.test(payload.nonce) ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number" ||
      !Number.isSafeInteger(payload.iat) ||
      !Number.isSafeInteger(payload.exp) ||
      payload.exp <= payload.iat ||
      payload.iat > Math.floor(this.#now().getTime() / 1000) + this.#clockToleranceSeconds ||
      payload.exp - payload.iat > this.#maxIdTokenLifetimeSeconds
    ) {
      throw new HumanIdentityProviderAuthenticationError();
    }
    return { issuer: discovery.issuer, subject: payload.sub, nonce: payload.nonce };
  }

  async exchangeAuthorizationCode(
    request: HumanAuthorizationCodeExchange
  ): Promise<HumanProviderIdentity> {
    if (!AUTHORIZATION_CODE.test(request.code) || !OPAQUE.test(request.codeVerifier)) {
      throw new HumanIdentityProviderAuthenticationError();
    }
    const discovery = await this.#loadDiscovery();
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: request.code,
      redirect_uri: normalizeRedirectUri(request.redirectUri),
      code_verifier: request.codeVerifier,
    });
    const headers: Record<string, string> = {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    };
    if (this.#tokenEndpointAuthMethod === "client_secret_basic") {
      headers.authorization = `Basic ${Buffer.from(
        `${formComponent(this.#clientId)}:${formComponent(this.#clientSecret)}`,
        "utf8"
      ).toString("base64")}`;
    } else {
      body.set("client_id", this.#clientId);
      body.set("client_secret", this.#clientSecret);
    }
    const response = await this.#request(discovery.tokenEndpoint, {
      method: "POST",
      headers,
      body: body.toString(),
    });
    if (response.status === 429 || response.status >= 500) {
      throw new HumanIdentityProviderUnavailableError();
    }
    if (!response.ok) throw new HumanIdentityProviderAuthenticationError();
    const tokenResponse = await readBoundedJson(response, this.#maxResponseBytes, JSON_MEDIA);
    const idToken = tokenResponse.id_token;
    const tokenType = tokenResponse.token_type;
    if (
      typeof idToken !== "string" ||
      idToken.length < 64 ||
      idToken.length > 16_384 ||
      !JWT.test(idToken) ||
      (tokenType !== undefined &&
        (typeof tokenType !== "string" || tokenType.toLowerCase() !== "bearer"))
    ) {
      throw new HumanIdentityProviderAuthenticationError();
    }
    try {
      return await this.#verifyIdToken(idToken, discovery, false);
    } catch (error) {
      if (error instanceof HumanIdentityProviderUnavailableError) throw error;
      if (!refreshableKeyError(error)) throw new HumanIdentityProviderAuthenticationError();
      try {
        return await this.#verifyIdToken(idToken, discovery, true);
      } catch (retryError) {
        if (retryError instanceof HumanIdentityProviderUnavailableError) throw retryError;
        throw new HumanIdentityProviderAuthenticationError();
      }
    }
  }
}
