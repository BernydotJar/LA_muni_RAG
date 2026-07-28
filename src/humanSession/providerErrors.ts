/**
 * Closed provider-boundary error for an ordinary authorization rejection.
 * Provider diagnostics never cross the BFF boundary.
 */
export class HumanIdentityProviderAuthenticationError extends Error {
  constructor() {
    super("Human identity provider rejected authentication");
    this.name = "HumanIdentityProviderAuthenticationError";
  }
}

/**
 * Closed provider-boundary error for transient unavailability. Recovery must
 * begin with a fresh login because the state and authorization code are spent.
 */
export class HumanIdentityProviderUnavailableError extends Error {
  constructor() {
    super("Human identity provider unavailable");
    this.name = "HumanIdentityProviderUnavailableError";
  }
}
