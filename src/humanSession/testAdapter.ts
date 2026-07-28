import { pkceChallenge } from "./crypto.js";
import { HumanIdentityProviderAuthenticationError } from "./providerErrors.js";
import type {
  HumanAuthorizationCodeExchange,
  HumanAuthorizationRequest,
  HumanIdentityProviderAdapter,
  HumanProviderIdentity,
} from "./types.js";

interface PendingAuthorization extends HumanAuthorizationRequest {
  code: string | null;
  identity: Omit<HumanProviderIdentity, "nonce"> | null;
  nonceOverride: string | null;
}

/**
 * Deterministic provider boundary for tests only. It never performs network I/O
 * and cannot be enabled while NODE_ENV=production.
 */
export class DeterministicHumanIdentityProvider implements HumanIdentityProviderAdapter {
  readonly kind = "test" as const;
  readonly providerId: string;
  private readonly pending = new Map<string, PendingAuthorization>();
  private readonly issuedCodes = new Map<string, PendingAuthorization>();

  constructor(providerId = "local-test-provider") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("The deterministic human identity provider is test-only");
    }
    this.providerId = providerId;
  }

  buildAuthorizationUrl(request: HumanAuthorizationRequest): URL {
    const url = new URL("https://test-idp.invalid/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", request.state);
    url.searchParams.set("nonce", request.nonce);
    url.searchParams.set("code_challenge", request.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("redirect_uri", request.redirectUri);
    this.pending.set(request.state, {
      ...request,
      code: null,
      identity: null,
      nonceOverride: null,
    });
    return url;
  }

  issueAuthorizationCode(
    state: string,
    identity: Omit<HumanProviderIdentity, "nonce">,
    code = `test-code-${state}`,
    nonceOverride: string | null = null
  ): string {
    const pending = this.pending.get(state);
    if (!pending || pending.code) throw new Error("Unknown or already issued test authorization state");
    const issued = { ...pending, code, identity, nonceOverride };
    this.pending.set(state, issued);
    this.issuedCodes.set(code, issued);
    return code;
  }

  async exchangeAuthorizationCode(
    request: HumanAuthorizationCodeExchange
  ): Promise<HumanProviderIdentity> {
    const pending = this.issuedCodes.get(request.code);
    if (
      !pending ||
      !pending.identity ||
      pending.redirectUri !== request.redirectUri ||
      pkceChallenge(request.codeVerifier) !== pending.codeChallenge
    ) {
      throw new HumanIdentityProviderAuthenticationError();
    }
    this.issuedCodes.delete(request.code);
    return {
      ...pending.identity,
      nonce: pending.nonceOverride ?? pending.nonce,
    };
  }
}
