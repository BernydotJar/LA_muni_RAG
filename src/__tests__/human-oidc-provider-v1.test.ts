import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SignJWT, exportJWK, generateKeyPair, type JWK } from "jose";
import {
  HumanIdentityProviderAuthenticationError,
  HumanIdentityProviderUnavailableError,
  OidcHumanIdentityProvider,
  loadHumanSessionBffOptionsFromEnv,
} from "../humanSession/index.js";

const ISSUER = "https://idp.example/tenant";
const CLIENT_ID = "la-muni-human-client";
const CLIENT_SECRET = "test-client-secret-with-32-characters";
const CALLBACK = "https://workspace.example/auth/callback";
const STATE = "s".repeat(43);
const NONCE = "n".repeat(43);
const CHALLENGE = "c".repeat(43);
const VERIFIER = "v".repeat(64);
const NOW = new Date("2026-07-28T19:30:00.000Z");

interface HarnessOptions {
  discovery?: Record<string, unknown>;
  clientId?: string;
  clientSecret?: string;
  tokenEndpointAuthMethod?: "client_secret_basic" | "client_secret_post";
  tokenStatus?: number;
  jwks?: Record<string, unknown>;
  tokenClaims?: Record<string, unknown>;
  tokenHeader?: Record<string, unknown>;
  tokenAudience?: string | string[];
  tokenIssuedAt?: number;
  tokenExpiresAt?: number;
}

const json = (value: unknown, status = 200, contentType = "application/json"): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": contentType },
  });

const createHarness = async (options: HarnessOptions = {}) => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const publicJwk: JWK = {
    ...(await exportJWK(publicKey)),
    kid: "key-1",
    alg: "RS256",
    use: "sig",
    key_ops: ["verify"],
  };
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const discovery = options.discovery ?? {
    issuer: ISSUER,
    authorization_endpoint: "https://idp.example/authorize",
    token_endpoint: "https://tokens.example/token",
    jwks_uri: "https://keys.example/jwks",
    response_types_supported: ["code"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["client_secret_basic"],
  };
  const clientId = options.clientId ?? CLIENT_ID;
  const clientSecret = options.clientSecret ?? CLIENT_SECRET;
  const nowSeconds = Math.floor(NOW.getTime() / 1000);
  const signToken = async (): Promise<string> =>
    new SignJWT({ nonce: NONCE, ...options.tokenClaims })
      .setProtectedHeader({ alg: "RS256", kid: "key-1", typ: "JWT", ...options.tokenHeader })
      .setIssuer(ISSUER)
      .setSubject("opaque-provider-subject")
      .setAudience(options.tokenAudience ?? clientId)
      .setIssuedAt(options.tokenIssuedAt ?? nowSeconds)
      .setExpirationTime(options.tokenExpiresAt ?? nowSeconds + 300)
      .sign(privateKey);

  const fakeFetch: typeof fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, init });
    if (url === `https://idp.example/.well-known/openid-configuration/tenant`) return json(discovery);
    if (url === "https://keys.example/jwks") {
      return json(options.jwks ?? { keys: [publicJwk] }, 200, "application/jwk-set+json");
    }
    if (url === "https://tokens.example/token") {
      const status = options.tokenStatus ?? 200;
      if (status !== 200) return json({ error: status >= 500 ? "server_error" : "invalid_grant" }, status);
      return json({ id_token: await signToken(), token_type: "Bearer", access_token: "not-consumed" });
    }
    throw new Error("unexpected fake OIDC URL");
  };

  return {
    calls,
    provider: new OidcHumanIdentityProvider({
      providerId: "approved-provider",
      issuer: ISSUER,
      clientId,
      clientSecret,
      allowedEndpointOrigins: [
        "https://idp.example",
        "https://tokens.example",
        "https://keys.example",
      ],
      tokenEndpointAuthMethod: options.tokenEndpointAuthMethod,
      fetch: fakeFetch,
      now: () => NOW,
    }),
  };
};

const exchange = (provider: OidcHumanIdentityProvider) =>
  provider.exchangeAuthorizationCode({
    code: "code-0001",
    codeVerifier: VERIFIER,
    redirectUri: CALLBACK,
  });

describe("Feature 083 provider-neutral productive OIDC adapter", () => {
  it("builds an authorization-code URL from validated discovery metadata", async () => {
    const { provider, calls } = await createHarness();
    const url = await provider.buildAuthorizationUrl({
      state: STATE,
      nonce: NONCE,
      codeChallenge: CHALLENGE,
      redirectUri: CALLBACK,
    });
    assert.equal(url.origin, "https://idp.example");
    assert.equal(url.pathname, "/authorize");
    assert.equal(url.searchParams.get("client_id"), CLIENT_ID);
    assert.equal(url.searchParams.get("redirect_uri"), CALLBACK);
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(url.searchParams.get("scope"), "openid");
    assert.equal(url.searchParams.get("state"), STATE);
    assert.equal(url.searchParams.get("nonce"), NONCE);
    assert.equal(url.searchParams.get("code_challenge"), CHALLENGE);
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.init?.redirect, "error");
    assert.ok(!url.toString().includes(CLIENT_SECRET));
  });

  it("exchanges by confidential POST and returns only issuer, subject and nonce", async () => {
    const { provider, calls } = await createHarness({
      tokenClaims: {
        roles: ["tenant_admin"],
        tenant_id: "attacker-tenant",
        email: "ignored@example.invalid",
      },
    });
    const identity = await exchange(provider);
    assert.deepEqual(identity, {
      issuer: ISSUER,
      subject: "opaque-provider-subject",
      nonce: NONCE,
    });
    assert.deepEqual(Object.keys(identity).sort(), ["issuer", "nonce", "subject"]);
    const tokenCall = calls.find((call) => call.url === "https://tokens.example/token");
    assert.equal(tokenCall?.init?.method, "POST");
    const headers = new Headers(tokenCall?.init?.headers);
    assert.match(headers.get("authorization") ?? "", /^Basic /);
    const body = new URLSearchParams(String(tokenCall?.init?.body));
    assert.equal(body.get("grant_type"), "authorization_code");
    assert.equal(body.get("code"), "code-0001");
    assert.equal(body.get("redirect_uri"), CALLBACK);
    assert.equal(body.get("code_verifier"), VERIFIER);
    assert.equal(body.get("client_secret"), null);
  });

  it("uses exact form encoding for confidential basic credentials", async () => {
    const clientId = "client id:with!symbols";
    const clientSecret = "secret value:with!symbols-and-length";
    const { provider, calls } = await createHarness({ clientId, clientSecret });
    await exchange(provider);
    const tokenCall = calls.find((call) => call.url === "https://tokens.example/token");
    const authorization = new Headers(tokenCall?.init?.headers).get("authorization") ?? "";
    const decoded = Buffer.from(authorization.replace(/^Basic /, ""), "base64").toString("utf8");
    const encode = (value: string) =>
      new URLSearchParams([["value", value]]).toString().slice("value=".length);
    assert.equal(decoded, `${encode(clientId)}:${encode(clientSecret)}`);
  });

  it("fails closed when discovery does not advertise PKCE S256 or the configured client method", async () => {
    const noPkce = await createHarness({
      discovery: {
        issuer: ISSUER,
        authorization_endpoint: "https://idp.example/authorize",
        token_endpoint: "https://tokens.example/token",
        jwks_uri: "https://keys.example/jwks",
        response_types_supported: ["code"],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["RS256"],
        token_endpoint_auth_methods_supported: ["client_secret_basic"],
      },
    });
    await assert.rejects(
      noPkce.provider.buildAuthorizationUrl({
        state: STATE,
        nonce: NONCE,
        codeChallenge: CHALLENGE,
        redirectUri: CALLBACK,
      }),
      HumanIdentityProviderUnavailableError
    );

    const unadvertisedPost = await createHarness({
      tokenEndpointAuthMethod: "client_secret_post",
      discovery: {
        issuer: ISSUER,
        authorization_endpoint: "https://idp.example/authorize",
        token_endpoint: "https://tokens.example/token",
        jwks_uri: "https://keys.example/jwks",
        response_types_supported: ["code"],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["RS256"],
        code_challenge_methods_supported: ["S256"],
      },
    });
    await assert.rejects(
      unadvertisedPost.provider.buildAuthorizationUrl({
        state: STATE,
        nonce: NONCE,
        codeChallenge: CHALLENGE,
        redirectUri: CALLBACK,
      }),
      HumanIdentityProviderUnavailableError
    );
  });

  it("rejects issuer drift and endpoints outside the explicit origin allowlist", async () => {
    const issuerDrift = await createHarness({
      discovery: {
        issuer: "https://evil.example",
        authorization_endpoint: "https://idp.example/authorize",
        token_endpoint: "https://tokens.example/token",
        jwks_uri: "https://keys.example/jwks",
        response_types_supported: ["code"],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["RS256"],
      },
    });
    await assert.rejects(
      issuerDrift.provider.buildAuthorizationUrl({
        state: STATE,
        nonce: NONCE,
        codeChallenge: CHALLENGE,
        redirectUri: CALLBACK,
      }),
      HumanIdentityProviderUnavailableError
    );

    const foreignEndpoint = await createHarness({
      discovery: {
        issuer: ISSUER,
        authorization_endpoint: "https://unapproved.example/authorize",
        token_endpoint: "https://tokens.example/token",
        jwks_uri: "https://keys.example/jwks",
        response_types_supported: ["code"],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["RS256"],
      },
    });
    await assert.rejects(
      foreignEndpoint.provider.buildAuthorizationUrl({
        state: STATE,
        nonce: NONCE,
        codeChallenge: CHALLENGE,
        redirectUri: CALLBACK,
      }),
      HumanIdentityProviderUnavailableError
    );
  });

  it("distinguishes ordinary token rejection from transient provider failure", async () => {
    const rejected = await createHarness({ tokenStatus: 400 });
    await assert.rejects(exchange(rejected.provider), HumanIdentityProviderAuthenticationError);
    const unavailable = await createHarness({ tokenStatus: 503 });
    await assert.rejects(exchange(unavailable.provider), HumanIdentityProviderUnavailableError);
  });

  it("rejects audience, authorized-party, time and nonce claim confusion", async () => {
    const nowSeconds = Math.floor(NOW.getTime() / 1000);
    const cases: Array<[string, HarnessOptions]> = [
      ["wrong audience", { tokenAudience: "different-client" }],
      ["multiple audience without azp", { tokenAudience: [CLIENT_ID, "other-client"] }],
      ["wrong azp", { tokenAudience: [CLIENT_ID, "other-client"], tokenClaims: { azp: "other-client" } }],
      ["future iat", { tokenIssuedAt: nowSeconds + 120, tokenExpiresAt: nowSeconds + 300 }],
      ["excessive lifetime", { tokenIssuedAt: nowSeconds - 4_000, tokenExpiresAt: nowSeconds + 100 }],
      ["expired", { tokenIssuedAt: nowSeconds - 500, tokenExpiresAt: nowSeconds - 100 }],
    ];
    for (const [name, options] of cases) {
      const { provider } = await createHarness(options);
      await assert.rejects(exchange(provider), HumanIdentityProviderAuthenticationError, name);
    }
  });

  it("rejects embedded-key headers and private or symmetric JWKS material", async () => {
    const embedded = await createHarness({ tokenHeader: { jku: "https://evil.example/jwks" } });
    await assert.rejects(exchange(embedded.provider), HumanIdentityProviderAuthenticationError);

    const privateJwks = await createHarness({
      jwks: { keys: [{ kty: "oct", kid: "symmetric", k: "secret", alg: "HS256" }] },
    });
    await assert.rejects(exchange(privateJwks.provider), HumanIdentityProviderUnavailableError);

    const duplicateKid = await createHarness({
      jwks: {
        keys: [
          { kty: "RSA", kid: "duplicate", use: "sig", key_ops: ["verify"] },
          { kty: "RSA", kid: "duplicate", use: "sig", key_ops: ["verify"] },
        ],
      },
    });
    await assert.rejects(exchange(duplicateKid.provider), HumanIdentityProviderUnavailableError);

    const incompatibleAlgorithm = await createHarness({
      jwks: {
        keys: [{ kty: "RSA", kid: "key-1", alg: "RS512", use: "sig", key_ops: ["verify"] }],
      },
    });
    await assert.rejects(
      exchange(incompatibleAlgorithm.provider),
      HumanIdentityProviderUnavailableError
    );
  });

  it("bounds metadata responses and caches validated discovery and JWKS", async () => {
    const oversizedProvider = new OidcHumanIdentityProvider({
      providerId: "approved-provider",
      issuer: ISSUER,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      fetch: async () =>
        new Response(JSON.stringify({ padding: "x".repeat(5_000) }), {
          headers: { "content-type": "application/json", "content-length": "5000" },
        }),
      maxResponseBytes: 4_096,
    });
    await assert.rejects(
      oversizedProvider.buildAuthorizationUrl({
        state: STATE,
        nonce: NONCE,
        codeChallenge: CHALLENGE,
        redirectUri: CALLBACK,
      }),
      HumanIdentityProviderUnavailableError
    );

    const { provider, calls } = await createHarness();
    await exchange(provider);
    await exchange(provider);
    assert.equal(
      calls.filter((call) => call.url === `https://idp.example/.well-known/openid-configuration/tenant`).length,
      1
    );
    assert.equal(calls.filter((call) => call.url === "https://keys.example/jwks").length, 1);
    assert.equal(calls.filter((call) => call.url === "https://tokens.example/token").length, 2);
  });

  it("loads productive composition only from complete explicit environment configuration", () => {
    assert.deepEqual(loadHumanSessionBffOptionsFromEnv({}), { enabled: false });
    assert.throws(
      () => loadHumanSessionBffOptionsFromEnv({ HUMAN_SESSION_ENABLED: "true" }),
      /PROVIDER_APPROVED=true/
    );
    const protectorKey = Buffer.alloc(32, 7).toString("base64url");
    const options = loadHumanSessionBffOptionsFromEnv({
      HUMAN_SESSION_ENABLED: "true",
      HUMAN_SESSION_PROVIDER_APPROVED: "true",
      HUMAN_SESSION_PUBLIC_ORIGIN: "https://workspace.example",
      HUMAN_SESSION_PROTECTOR_KEY_BASE64URL: protectorKey,
      HUMAN_SESSION_OIDC_PROVIDER_ID: "approved-provider",
      HUMAN_SESSION_OIDC_ISSUER: ISSUER,
      HUMAN_SESSION_OIDC_CLIENT_ID: CLIENT_ID,
      HUMAN_SESSION_OIDC_CLIENT_SECRET: CLIENT_SECRET,
      HUMAN_SESSION_OIDC_ALLOWED_ENDPOINT_ORIGINS:
        "https://tokens.example,https://keys.example",
    });
    assert.equal(options.enabled, true);
    assert.equal(options.approvedProvider, true);
    assert.equal(options.provider?.kind, "oidc");
    assert.equal(options.protector?.kind, "aes-256-gcm");
    const serialized = JSON.stringify(options);
    assert.ok(!serialized.includes(CLIENT_SECRET));
    assert.ok(!serialized.includes(protectorKey));
  });
});
