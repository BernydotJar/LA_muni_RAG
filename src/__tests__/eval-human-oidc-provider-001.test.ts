import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const read = (path: string): Promise<string> => readFile(path, "utf8");

describe("EVAL-HUMAN-OIDC-PROVIDER-001", () => {
  it("uses exact OIDC discovery and an explicit HTTPS endpoint-origin allowlist", async () => {
    const adapter = await read("src/humanSession/oidcAdapter.ts");
    assert.match(adapter, /\.well-known\/openid-configuration/);
    assert.match(adapter, /document\.issuer !== this\.#issuer/);
    assert.match(adapter, /allowedEndpointOrigins/);
    assert.match(adapter, /parsed\.protocol !== "https:"/);
    assert.match(adapter, /redirect: "error"/);
    assert.doesNotMatch(adapter, /redirect: "follow"/);
  });

  it("uses authorization code, confidential client authentication and PKCE S256", async () => {
    const adapter = await read("src/humanSession/oidcAdapter.ts");
    assert.match(adapter, /response_type", "code"/);
    assert.match(adapter, /scope", "openid"/);
    assert.match(adapter, /code_challenge_method", "S256"/);
    assert.match(adapter, /grant_type: "authorization_code"/);
    assert.match(adapter, /code_verifier: request\.codeVerifier/);
    assert.match(adapter, /client_secret_basic/);
    assert.match(adapter, /client_secret_post/);
    assert.doesNotMatch(adapter, /searchParams\.set\("client_secret"/);
  });

  it("accepts only asymmetric allowlisted ID-token algorithms and public verification keys", async () => {
    const adapter = await read("src/humanSession/oidcAdapter.ts");
    assert.match(adapter, /\["RS256", "PS256", "ES256"\]/);
    assert.doesNotMatch(adapter, /HS256|none/);
    assert.match(adapter, /key\.kty !== "RSA" && key\.kty !== "EC"/);
    assert.match(adapter, /key\.d !== undefined/);
    assert.match(adapter, /key\.k !== undefined/);
    assert.match(adapter, /header\.jku !== undefined/);
    assert.match(adapter, /header\.jwk !== undefined/);
  });

  it("validates issuer, audience, azp, signature, nonce presence and bounded token time", async () => {
    const adapter = await read("src/humanSession/oidcAdapter.ts");
    assert.match(adapter, /jwtVerify\(idToken/);
    assert.match(adapter, /issuer: discovery\.issuer/);
    assert.match(adapter, /audience: this\.#clientId/);
    assert.match(adapter, /requiredClaims: \["iss", "sub", "aud", "exp", "iat", "nonce"\]/);
    assert.match(adapter, /audiences\.length > 1 && payload\.azp !== this\.#clientId/);
    assert.match(adapter, /payload\.iat > Math\.floor/);
    assert.match(adapter, /payload\.exp - payload\.iat > this\.#maxIdTokenLifetimeSeconds/);
    const handler = await read("src/humanSession/handler.ts");
    assert.match(handler, /timingSafeEqual\(actualNonce, expectedNonce\)/);
  });

  it("bounds network responses, timeouts and key caches", async () => {
    const adapter = await read("src/humanSession/oidcAdapter.ts");
    assert.match(adapter, /AbortController/);
    assert.match(adapter, /setTimeout\(\(\) => controller\.abort\(\)/);
    assert.match(adapter, /total > maximumBytes/);
    assert.match(adapter, /keys\.length > 100/);
    assert.match(adapter, /#discoveryCache/);
    assert.match(adapter, /#jwksCache/);
    assert.match(adapter, /forceKeyRefresh/);
  });

  it("keeps provider rejection distinct from transient provider unavailability", async () => {
    const handler = await read("src/humanSession/handler.ts");
    const providerErrors = await read("src/humanSession/providerErrors.ts");
    assert.match(providerErrors, /HumanIdentityProviderAuthenticationError/);
    assert.match(providerErrors, /HumanIdentityProviderUnavailableError/);
    assert.match(handler, /HumanIdentityProviderAuthenticationError[\s\S]*401,[\s\S]*"human_authentication_failed"/);
    assert.match(handler, /HumanIdentityProviderUnavailableError[\s\S]*503,[\s\S]*"human_identity_unavailable"/);
    assert.doesNotMatch(handler, /error\.message.*provider/i);
  });

  it("loads only an explicitly approved complete server-side composition", async () => {
    const config = await read("src/humanSession/config.ts");
    const env = await read(".env.example");
    const crypto = await read("src/humanSession/crypto.ts");
    assert.match(config, /HUMAN_SESSION_ENABLED/);
    assert.match(config, /HUMAN_SESSION_PROVIDER_APPROVED/);
    assert.match(config, /PROVIDER_APPROVED=true is required/);
    assert.match(config, /HUMAN_SESSION_OIDC_CLIENT_SECRET/);
    assert.match(config, /AesGcmSecretProtector/);
    assert.match(env, /HUMAN_SESSION_ENABLED=false/);
    assert.match(crypto, /readonly #key: Buffer/);
    assert.doesNotMatch(config, /console\.|process\.stdout|process\.stderr/);
  });

  it("projects no provider roles, groups, tenant or personal profile claims", async () => {
    const adapter = await read("src/humanSession/oidcAdapter.ts");
    const identityReturn = adapter.slice(
      adapter.lastIndexOf("return { issuer:"),
      adapter.lastIndexOf("return { issuer:") + 180
    );
    assert.match(identityReturn, /issuer: discovery\.issuer/);
    assert.match(identityReturn, /subject: payload\.sub/);
    assert.match(identityReturn, /nonce: payload\.nonce/);
    assert.doesNotMatch(identityReturn, /role|group|tenant|email|name/i);
    const handler = await read("src/humanSession/handler.ts");
    assert.match(handler, /resolveHumanMembership/);
    assert.match(handler, /issuerSha256: sha256Hex\(providerIdentity\.issuer\)/);
    assert.match(handler, /subjectSha256: sha256Hex\(providerIdentity\.subject\)/);
  });

  it("wires focused, named-EVAL and CI gates without claiming productive journeys", async () => {
    const packageJson = JSON.parse(await read("package.json")) as { scripts: Record<string, string> };
    assert.match(packageJson.scripts["test:human-oidc-provider"] ?? "", /human-oidc-provider-v1/);
    assert.match(packageJson.scripts["eval:human-oidc-provider"] ?? "", /eval-human-oidc-provider-001/);
    const ci = await read(".github/workflows/ci.yml");
    assert.match(ci, /EVAL-HUMAN-OIDC-PROVIDER-001/);
    const spec = await read("specs/083-provider-neutral-oidc-adapter-v1/spec.md");
    const review = await read("docs/reviews/083-provider-neutral-oidc-adapter-independent-review.md");
    assert.match(spec, /Productive authenticated journeys remain `0\/12`/);
    assert.match(review, /does not select, provision or approve an IdP/i);
    assert.match(review, /not production readiness/i);
  });
});
