import type { HumanSecurityRole, SecurityPermission } from "../security/rbac.js";

export type HumanIdentityProviderKind = "oidc" | "test";

export interface HumanAuthorizationRequest {
  state: string;
  nonce: string;
  codeChallenge: string;
  redirectUri: string;
}

export interface HumanAuthorizationCodeExchange {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}

export interface HumanProviderIdentity {
  /** Exact normalized issuer URI; never an email address or display name. */
  issuer: string;
  /** Opaque provider subject. It is hashed before the repository boundary. */
  subject: string;
  /** Nonce recovered from the validated ID token. */
  nonce: string;
}

export interface HumanIdentityProviderAdapter {
  readonly kind: HumanIdentityProviderKind;
  readonly providerId: string;
  buildAuthorizationUrl(request: HumanAuthorizationRequest): URL;
  exchangeAuthorizationCode(
    request: HumanAuthorizationCodeExchange
  ): Promise<HumanProviderIdentity>;
}

export interface SecretProtector {
  readonly kind: "aes-256-gcm" | "test-only";
  seal(plaintext: string): string;
  open(protectedValue: string): string;
}

export interface LoginTransactionInput {
  stateSha256: string;
  browserBindingSha256: string;
  providerId: string;
  protectedChallenge: string;
  returnPath: string;
  expiresAt: Date;
}

export interface ConsumedLoginTransaction {
  transactionId: string;
  protectedChallenge: string;
  returnPath: string;
  expiresAt: Date;
}

export interface HumanMembershipRecord {
  humanSubjectId: string;
  tenantId: string;
  principalId: string;
  roles: readonly HumanSecurityRole[];
}

export interface HumanSessionRecord extends HumanMembershipRecord {
  sessionId: string;
  issuedAt: Date;
  expiresAt: Date;
  csrfSha256: string;
  generation: number;
}

export interface CreateHumanSessionInput extends HumanMembershipRecord {
  sessionId: string;
  sessionTokenSha256: string;
  csrfSha256: string;
  issuedAt: Date;
  expiresAt: Date;
  generation: number;
}

export interface RotateHumanSessionInput {
  currentSessionTokenSha256: string;
  replacement: CreateHumanSessionInput;
}

export const HUMAN_SESSION_AUDIT_EVENT_TYPES = [
  "identity.human_login_succeeded",
  "identity.human_session_authenticated",
  "identity.human_session_rotated",
  "identity.human_logout_succeeded",
  "identity.human_session_denied",
] as const;

export type HumanSessionAuditEventType = (typeof HUMAN_SESSION_AUDIT_EVENT_TYPES)[number];

export const HUMAN_SESSION_AUDIT_REASON_CODES = [
  "login_completed",
  "session_valid",
  "session_rotated",
  "logout_completed",
  "session_rejected",
  "csrf_rejected",
] as const;

export type HumanSessionAuditReasonCode =
  (typeof HUMAN_SESSION_AUDIT_REASON_CODES)[number];

export interface HumanSessionAuditInput {
  tenantId: string;
  principalId: string;
  sessionId: string;
  requestId: string;
  eventType: HumanSessionAuditEventType;
  outcome: "success" | "blocked";
  reasonCode: HumanSessionAuditReasonCode;
}

export const HUMAN_AUTH_FAILURE_REASONS = [
  "invalid_request",
  "state_rejected",
  "code_replay",
  "provider_rejected",
  "membership_rejected",
  "session_rejected",
  "csrf_rejected",
] as const;

export type HumanAuthenticationFailureReason =
  (typeof HUMAN_AUTH_FAILURE_REASONS)[number];

export interface HumanSessionRepository {
  createLoginTransaction(input: LoginTransactionInput): Promise<string>;
  consumeLoginTransaction(input: {
    stateSha256: string;
    browserBindingSha256: string;
    providerId: string;
    now: Date;
  }): Promise<ConsumedLoginTransaction | null>;
  claimAuthorizationCode(input: {
    providerId: string;
    codeSha256: string;
    expiresAt: Date;
  }): Promise<boolean>;
  resolveHumanMembership(input: {
    providerId: string;
    issuerSha256: string;
    subjectSha256: string;
  }): Promise<HumanMembershipRecord | null>;
  createSession(input: CreateHumanSessionInput): Promise<void>;
  authenticateSession(input: {
    sessionTokenSha256: string;
    now: Date;
  }): Promise<HumanSessionRecord | null>;
  rotateSession(input: RotateHumanSessionInput): Promise<boolean>;
  revokeSession(input: {
    sessionTokenSha256: string;
    revokedAt: Date;
  }): Promise<HumanSessionRecord | null>;
  recordAudit(input: HumanSessionAuditInput): Promise<void>;
  recordAuthenticationFailure(input: {
    requestId: string;
    reasonCode: HumanAuthenticationFailureReason;
  }): Promise<void>;
}

export interface AuthenticatedHumanSession {
  sessionId: string;
  tenantId: string;
  principalId: string;
  humanSubjectId: string;
  roles: readonly HumanSecurityRole[];
  permissions: readonly SecurityPermission[];
  issuedAt: Date;
  expiresAt: Date;
  csrfSha256: string;
  generation: number;
  sessionTokenSha256: string;
}

export interface HumanSessionBffDependencies {
  enabled: boolean;
  approvedProvider: boolean;
  provider: HumanIdentityProviderAdapter | null;
  repository: HumanSessionRepository | null;
  protector: SecretProtector | null;
  publicOrigin: string | null;
  allowedReturnPaths: readonly string[];
  loginTtlSeconds: number;
  sessionTtlSeconds: number;
  authorizationCodeReplayTtlSeconds: number;
  secureCookies: boolean;
  sessionCookieName: string;
  loginCookieName: string;
  now: () => Date;
  randomOpaque: (bytes: number) => string;
  createUuid: () => string;
}

export interface HumanSessionBffOptions
  extends Partial<
    Omit<
      HumanSessionBffDependencies,
      | "secureCookies"
      | "sessionCookieName"
      | "loginCookieName"
      | "randomOpaque"
    >
  > {
  randomOpaque?: (bytes: number) => string;
}
