import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { isSecurityRole, permissionsForRoles } from "../security/rbac.js";
import { isCanonicalUuid } from "../security/tenant.js";
import { digestsEqual, pkceChallenge, sha256Hex } from "./crypto.js";
import type {
  AuthenticatedHumanSession,
  HumanAuthenticationFailureReason,
  HumanSessionAuditReasonCode,
  HumanSessionBffDependencies,
  HumanSessionRecord,
} from "./types.js";

export const HUMAN_LOGIN_ROUTE = "/auth/login";
export const HUMAN_CALLBACK_ROUTE = "/auth/callback";
export const HUMAN_SESSION_ROUTE = "/auth/session";
export const HUMAN_SESSION_ROTATE_ROUTE = "/auth/session/rotate";
export const HUMAN_LOGOUT_ROUTE = "/auth/logout";

const HUMAN_SESSION_ROUTES = new Set([
  HUMAN_LOGIN_ROUTE,
  HUMAN_CALLBACK_ROUTE,
  HUMAN_SESSION_ROUTE,
  HUMAN_SESSION_ROTATE_ROUTE,
  HUMAN_LOGOUT_ROUTE,
]);
const OPAQUE_TOKEN = /^[A-Za-z0-9_-]{43,172}$/;
const AUTHORIZATION_CODE = /^[A-Za-z0-9._~-]{8,512}$/;
const PROVIDER_VALUE_CONTROL = /[\u0000-\u001f\u007f]/;

class HumanSessionHttpError extends Error {
  constructor(
    readonly statusCode: 400 | 401 | 403 | 405 | 500 | 503,
    readonly code: string,
    message: string,
    readonly reasonCode: HumanAuthenticationFailureReason,
    readonly clearLoginCookie = false,
    readonly clearSessionCookie = false
  ) {
    super(message);
    this.name = "HumanSessionHttpError";
  }
}

const singleHeader = (value: string | string[] | undefined): string | null =>
  typeof value === "string" ? value : null;

const addSeconds = (date: Date, seconds: number): Date =>
  new Date(date.getTime() + seconds * 1000);

const cookie = (
  name: string,
  value: string,
  maxAge: number,
  secure: boolean
): string =>
  `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;

const clearCookie = (name: string, secure: boolean): string =>
  `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;

const parseCookie = (req: IncomingMessage, name: string): string | null => {
  const header = singleHeader(req.headers.cookie);
  if (!header || header.length > 4096 || PROVIDER_VALUE_CONTROL.test(header)) return null;
  const matches = header
    .split(";")
    .map((item) => item.trim())
    .filter((item) => item.startsWith(`${name}=`));
  if (matches.length !== 1) return null;
  const value = matches[0]!.slice(name.length + 1);
  return OPAQUE_TOKEN.test(value) ? value : null;
};

const sendJson = (
  res: ServerResponse,
  statusCode: number,
  body: unknown,
  requestId: string,
  cookies: readonly string[] = []
): void => {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
    pragma: "no-cache",
    "x-content-type-options": "nosniff",
    "x-request-id": requestId,
    ...(cookies.length ? { "set-cookie": [...cookies] } : {}),
  });
  res.end(payload);
};

const sendRedirect = (
  res: ServerResponse,
  statusCode: 302 | 303,
  location: string,
  requestId: string,
  cookies: readonly string[]
): void => {
  res.writeHead(statusCode, {
    location,
    "cache-control": "no-store",
    pragma: "no-cache",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-request-id": requestId,
    "set-cookie": [...cookies],
  });
  res.end();
};

const requestId = (req: IncomingMessage, dependencies: HumanSessionBffDependencies): string => {
  const supplied = singleHeader(req.headers["x-request-id"]);
  return isCanonicalUuid(supplied) ? supplied.toLowerCase() : dependencies.createUuid();
};

const ensureNoAuthorizationHeader = (req: IncomingMessage): void => {
  if (req.headers.authorization !== undefined) {
    throw new HumanSessionHttpError(
      400,
      "invalid_browser_authentication",
      "Browser session routes do not accept Authorization headers",
      "invalid_request"
    );
  }
};

const ensureNoRequestBody = (req: IncomingMessage): void => {
  const contentLength = singleHeader(req.headers["content-length"]);
  if (
    req.headers["transfer-encoding"] !== undefined ||
    (contentLength !== null && contentLength !== "0")
  ) {
    throw new HumanSessionHttpError(
      400,
      "request_body_forbidden",
      "This browser session request must not include a body",
      "invalid_request"
    );
  }
};

const requireEnabled: (
  dependencies: HumanSessionBffDependencies
) => asserts dependencies is HumanSessionBffDependencies & {
  provider: NonNullable<HumanSessionBffDependencies["provider"]>;
  repository: NonNullable<HumanSessionBffDependencies["repository"]>;
  protector: NonNullable<HumanSessionBffDependencies["protector"]>;
  publicOrigin: string;
} = (dependencies) => {
  if (
    !dependencies.enabled ||
    !dependencies.approvedProvider ||
    !dependencies.provider ||
    !dependencies.repository ||
    !dependencies.protector ||
    !dependencies.publicOrigin
  ) {
    throw new HumanSessionHttpError(
      503,
      "human_identity_unavailable",
      "Human sign-in is not configured",
      "invalid_request"
    );
  }
};

const safeReturnPath = (url: URL, dependencies: HumanSessionBffDependencies): string => {
  const requested = url.searchParams.get("return_to") ?? dependencies.allowedReturnPaths[0] ?? "/";
  if (!dependencies.allowedReturnPaths.includes(requested)) {
    throw new HumanSessionHttpError(
      400,
      "invalid_return_path",
      "Return path is not allowed",
      "invalid_request"
    );
  }
  return requested;
};

const parseProtectedChallenge = (
  protectedChallenge: string,
  dependencies: HumanSessionBffDependencies & {
    protector: NonNullable<HumanSessionBffDependencies["protector"]>;
  }
): { nonce: string; codeVerifier: string } => {
  let value: unknown;
  try {
    value = JSON.parse(dependencies.protector.open(protectedChallenge));
  } catch {
    throw new HumanSessionHttpError(
      401,
      "human_authentication_failed",
      "Authentication failed",
      "state_rejected",
      true
    );
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HumanSessionHttpError(401, "human_authentication_failed", "Authentication failed", "state_rejected", true);
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const nonce = (value as { nonce?: unknown }).nonce;
  const codeVerifier = (value as { codeVerifier?: unknown }).codeVerifier;
  if (
    keys.join(",") !== "codeVerifier,nonce" ||
    typeof nonce !== "string" ||
    typeof codeVerifier !== "string" ||
    !OPAQUE_TOKEN.test(nonce) ||
    !OPAQUE_TOKEN.test(codeVerifier)
  ) {
    throw new HumanSessionHttpError(401, "human_authentication_failed", "Authentication failed", "state_rejected", true);
  }
  return { nonce, codeVerifier };
};

const normalizeProviderIdentity = (identity: {
  issuer: string;
  subject: string;
  nonce: string;
}): { issuer: string; subject: string; nonce: string } => {
  if (
    identity.issuer.length < 8 ||
    identity.issuer.length > 500 ||
    identity.subject.length < 1 ||
    identity.subject.length > 255 ||
    identity.nonce.length < 43 ||
    identity.nonce.length > 172 ||
    PROVIDER_VALUE_CONTROL.test(identity.issuer) ||
    PROVIDER_VALUE_CONTROL.test(identity.subject) ||
    !OPAQUE_TOKEN.test(identity.nonce)
  ) {
    throw new HumanSessionHttpError(401, "human_authentication_failed", "Authentication failed", "provider_rejected", true);
  }
  let issuer: URL;
  try {
    issuer = new URL(identity.issuer);
  } catch {
    throw new HumanSessionHttpError(401, "human_authentication_failed", "Authentication failed", "provider_rejected", true);
  }
  if (
    issuer.protocol !== "https:" ||
    issuer.username ||
    issuer.password ||
    issuer.search ||
    issuer.hash
  ) {
    throw new HumanSessionHttpError(401, "human_authentication_failed", "Authentication failed", "provider_rejected", true);
  }
  return { issuer: issuer.href.replace(/\/$/, ""), subject: identity.subject, nonce: identity.nonce };
};

const safeAudit = async (
  dependencies: HumanSessionBffDependencies,
  session: Pick<AuthenticatedHumanSession, "tenantId" | "principalId" | "sessionId">,
  requestIdValue: string,
  input: {
    eventType:
      | "identity.human_login_succeeded"
      | "identity.human_session_authenticated"
      | "identity.human_session_rotated"
      | "identity.human_logout_succeeded"
      | "identity.human_session_denied";
    outcome: "success" | "blocked";
    reasonCode: HumanSessionAuditReasonCode;
  }
): Promise<void> => {
  if (!dependencies.repository) return;
  await dependencies.repository.recordAudit({
    tenantId: session.tenantId,
    principalId: session.principalId,
    sessionId: session.sessionId,
    requestId: requestIdValue,
    ...input,
  });
};

const safeFailureAudit = async (
  dependencies: HumanSessionBffDependencies,
  requestIdValue: string,
  reasonCode: HumanAuthenticationFailureReason
): Promise<void> => {
  try {
    await dependencies.repository?.recordAuthenticationFailure({
      requestId: requestIdValue,
      reasonCode,
    });
  } catch {
    // Client response remains generic. Failure aggregation cannot expose internals.
  }
};

const validateSessionRecord = (
  record: HumanSessionRecord | null,
  sessionTokenSha256: string
): AuthenticatedHumanSession | null => {
  if (
    !record ||
    !isCanonicalUuid(record.sessionId) ||
    !isCanonicalUuid(record.tenantId) ||
    !isCanonicalUuid(record.principalId) ||
    !isCanonicalUuid(record.humanSubjectId) ||
    !/^[0-9a-f]{64}$/.test(record.csrfSha256) ||
    !Number.isSafeInteger(record.generation) ||
    record.generation < 1 ||
    record.roles.length < 1 ||
    !record.roles.every(isSecurityRole)
  ) {
    return null;
  }
  const permissions = permissionsForRoles(record.roles);
  if (permissions.length < 1) return null;
  return {
    ...record,
    roles: Object.freeze([...new Set(record.roles)]),
    permissions,
    sessionTokenSha256,
  };
};

const authenticateRequest = async (
  req: IncomingMessage,
  dependencies: HumanSessionBffDependencies & {
    repository: NonNullable<HumanSessionBffDependencies["repository"]>;
  },
  now: Date
): Promise<AuthenticatedHumanSession> => {
  const token = parseCookie(req, dependencies.sessionCookieName);
  if (!token) {
    throw new HumanSessionHttpError(
      401,
      "authentication_required",
      "Authentication required",
      "session_rejected",
      false,
      true
    );
  }
  const tokenSha256 = sha256Hex(token);
  const session = validateSessionRecord(
    await dependencies.repository.authenticateSession({ sessionTokenSha256: tokenSha256, now }),
    tokenSha256
  );
  if (!session || session.expiresAt.getTime() <= now.getTime()) {
    throw new HumanSessionHttpError(
      401,
      "authentication_required",
      "Authentication required",
      "session_rejected",
      false,
      true
    );
  }
  return session;
};

const requireMutationProof = async (
  req: IncomingMessage,
  dependencies: HumanSessionBffDependencies & { publicOrigin: string },
  session: AuthenticatedHumanSession,
  requestIdValue: string
): Promise<void> => {
  const origin = singleHeader(req.headers.origin);
  const csrf = singleHeader(req.headers["x-csrf-token"]);
  const csrfValid = Boolean(
    csrf &&
      OPAQUE_TOKEN.test(csrf) &&
      digestsEqual(sha256Hex(csrf), session.csrfSha256)
  );
  if (origin !== dependencies.publicOrigin || !csrfValid) {
    try {
      await safeAudit(dependencies, session, requestIdValue, {
        eventType: "identity.human_session_denied",
        outcome: "blocked",
        reasonCode: "csrf_rejected",
      });
    } catch {
      // Preserve the same denial even when the audit sink is unavailable.
    }
    throw new HumanSessionHttpError(
      403,
      "csrf_rejected",
      "Request verification failed",
      "csrf_rejected"
    );
  }
};

const requireBootstrapProof = async (
  req: IncomingMessage,
  dependencies: HumanSessionBffDependencies & { publicOrigin: string },
  session: AuthenticatedHumanSession,
  requestIdValue: string
): Promise<void> => {
  const origin = singleHeader(req.headers.origin);
  const proof = singleHeader(req.headers["x-session-bootstrap"]);
  const fetchSite = singleHeader(req.headers["sec-fetch-site"]);
  if (
    origin !== dependencies.publicOrigin ||
    proof !== "v1" ||
    (fetchSite !== null && fetchSite !== "same-origin")
  ) {
    try {
      await safeAudit(dependencies, session, requestIdValue, {
        eventType: "identity.human_session_denied",
        outcome: "blocked",
        reasonCode: "csrf_rejected",
      });
    } catch {
      // Preserve the same denial even when the audit sink is unavailable.
    }
    throw new HumanSessionHttpError(
      403,
      "csrf_rejected",
      "Request verification failed",
      "csrf_rejected"
    );
  }
};

const handleLogin = async (
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  dependencies: HumanSessionBffDependencies,
  requestIdValue: string
): Promise<void> => {
  requireEnabled(dependencies);
  if (req.method !== "GET") {
    throw new HumanSessionHttpError(405, "method_not_allowed", "Method not allowed", "invalid_request");
  }
  ensureNoAuthorizationHeader(req);
  ensureNoRequestBody(req);
  const returnPath = safeReturnPath(url, dependencies);
  const now = dependencies.now();
  const state = dependencies.randomOpaque(32);
  const nonce = dependencies.randomOpaque(32);
  const codeVerifier = dependencies.randomOpaque(48);
  const browserBinding = dependencies.randomOpaque(32);
  const challenge = pkceChallenge(codeVerifier);
  const callbackUrl = `${dependencies.publicOrigin}${HUMAN_CALLBACK_ROUTE}`;
  const authorizationUrl = dependencies.provider.buildAuthorizationUrl({
    state,
    nonce,
    codeChallenge: challenge,
    redirectUri: callbackUrl,
  });
  if (
    authorizationUrl.protocol !== "https:" ||
    authorizationUrl.username ||
    authorizationUrl.password ||
    authorizationUrl.searchParams.get("state") !== state ||
    authorizationUrl.searchParams.get("nonce") !== nonce ||
    authorizationUrl.searchParams.get("code_challenge") !== challenge ||
    authorizationUrl.searchParams.get("code_challenge_method") !== "S256" ||
    authorizationUrl.searchParams.get("redirect_uri") !== callbackUrl ||
    authorizationUrl.searchParams.get("response_type") !== "code"
  ) {
    throw new HumanSessionHttpError(503, "human_identity_unavailable", "Human sign-in is not configured", "provider_rejected");
  }
  const protectedChallenge = dependencies.protector.seal(
    JSON.stringify({ codeVerifier, nonce })
  );
  await dependencies.repository.createLoginTransaction({
    stateSha256: sha256Hex(state),
    browserBindingSha256: sha256Hex(browserBinding),
    providerId: dependencies.provider.providerId,
    protectedChallenge,
    returnPath,
    expiresAt: addSeconds(now, dependencies.loginTtlSeconds),
  });
  sendRedirect(res, 302, authorizationUrl.toString(), requestIdValue, [
    clearCookie(dependencies.sessionCookieName, dependencies.secureCookies),
    cookie(
      dependencies.loginCookieName,
      browserBinding,
      dependencies.loginTtlSeconds,
      dependencies.secureCookies
    ),
  ]);
};

const handleCallback = async (
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  dependencies: HumanSessionBffDependencies,
  requestIdValue: string
): Promise<void> => {
  requireEnabled(dependencies);
  if (req.method !== "GET") {
    throw new HumanSessionHttpError(405, "method_not_allowed", "Method not allowed", "invalid_request", true);
  }
  ensureNoAuthorizationHeader(req);
  ensureNoRequestBody(req);
  const stateValues = url.searchParams.getAll("state");
  const codeValues = url.searchParams.getAll("code");
  if (
    stateValues.length !== 1 ||
    codeValues.length !== 1 ||
    !OPAQUE_TOKEN.test(stateValues[0] ?? "") ||
    !AUTHORIZATION_CODE.test(codeValues[0] ?? "") ||
    url.searchParams.has("error")
  ) {
    throw new HumanSessionHttpError(401, "human_authentication_failed", "Authentication failed", "invalid_request", true);
  }
  const browserBinding = parseCookie(req, dependencies.loginCookieName);
  if (!browserBinding) {
    throw new HumanSessionHttpError(401, "human_authentication_failed", "Authentication failed", "state_rejected", true);
  }
  const now = dependencies.now();
  const state = stateValues[0]!;
  const code = codeValues[0]!;
  const transaction = await dependencies.repository.consumeLoginTransaction({
    stateSha256: sha256Hex(state),
    browserBindingSha256: sha256Hex(browserBinding),
    providerId: dependencies.provider.providerId,
    now,
  });
  if (!transaction) {
    throw new HumanSessionHttpError(401, "human_authentication_failed", "Authentication failed", "state_rejected", true);
  }
  const challenge = parseProtectedChallenge(transaction.protectedChallenge, dependencies);
  const claimed = await dependencies.repository.claimAuthorizationCode({
    providerId: dependencies.provider.providerId,
    codeSha256: sha256Hex(code),
    expiresAt: addSeconds(now, dependencies.authorizationCodeReplayTtlSeconds),
  });
  if (!claimed) {
    throw new HumanSessionHttpError(401, "human_authentication_failed", "Authentication failed", "code_replay", true);
  }
  let providerIdentity;
  try {
    providerIdentity = normalizeProviderIdentity(
      await dependencies.provider.exchangeAuthorizationCode({
        code,
        codeVerifier: challenge.codeVerifier,
        redirectUri: `${dependencies.publicOrigin}${HUMAN_CALLBACK_ROUTE}`,
      })
    );
  } catch (error) {
    if (error instanceof HumanSessionHttpError) throw error;
    throw new HumanSessionHttpError(401, "human_authentication_failed", "Authentication failed", "provider_rejected", true);
  }
  const actualNonce = Buffer.from(sha256Hex(providerIdentity.nonce), "hex");
  const expectedNonce = Buffer.from(sha256Hex(challenge.nonce), "hex");
  if (!timingSafeEqual(actualNonce, expectedNonce)) {
    throw new HumanSessionHttpError(401, "human_authentication_failed", "Authentication failed", "provider_rejected", true);
  }
  const membership = await dependencies.repository.resolveHumanMembership({
    providerId: dependencies.provider.providerId,
    issuerSha256: sha256Hex(providerIdentity.issuer),
    subjectSha256: sha256Hex(providerIdentity.subject),
  });
  if (
    !membership ||
    !isCanonicalUuid(membership.humanSubjectId) ||
    !isCanonicalUuid(membership.tenantId) ||
    !isCanonicalUuid(membership.principalId) ||
    membership.roles.length < 1 ||
    !membership.roles.every(isSecurityRole)
  ) {
    throw new HumanSessionHttpError(403, "human_membership_required", "Tenant membership is required", "membership_rejected", true);
  }
  const sessionToken = dependencies.randomOpaque(32);
  const csrfToken = dependencies.randomOpaque(32);
  const sessionId = dependencies.createUuid();
  const expiresAt = addSeconds(now, dependencies.sessionTtlSeconds);
  await dependencies.repository.createSession({
    ...membership,
    sessionId,
    sessionTokenSha256: sha256Hex(sessionToken),
    csrfSha256: sha256Hex(csrfToken),
    issuedAt: now,
    expiresAt,
    generation: 1,
  });
  try {
    await safeAudit(
      dependencies,
      { tenantId: membership.tenantId, principalId: membership.principalId, sessionId },
      requestIdValue,
      {
        eventType: "identity.human_login_succeeded",
        outcome: "success",
        reasonCode: "login_completed",
      }
    );
  } catch {
    await dependencies.repository.revokeSession({
      sessionTokenSha256: sha256Hex(sessionToken),
      revokedAt: now,
    });
    throw new HumanSessionHttpError(500, "internal_error", "Unexpected server error", "session_rejected", true, true);
  }
  sendRedirect(res, 303, transaction.returnPath, requestIdValue, [
    cookie(
      dependencies.sessionCookieName,
      sessionToken,
      dependencies.sessionTtlSeconds,
      dependencies.secureCookies
    ),
    clearCookie(dependencies.loginCookieName, dependencies.secureCookies),
  ]);
};

const handleSession = async (
  req: IncomingMessage,
  res: ServerResponse,
  dependencies: HumanSessionBffDependencies,
  requestIdValue: string
): Promise<void> => {
  requireEnabled(dependencies);
  if (req.method !== "POST") {
    throw new HumanSessionHttpError(405, "method_not_allowed", "Method not allowed", "invalid_request");
  }
  ensureNoAuthorizationHeader(req);
  ensureNoRequestBody(req);
  const now = dependencies.now();
  const session = await authenticateRequest(req, dependencies, now);
  await requireBootstrapProof(req, dependencies, session, requestIdValue);
  const replacementToken = dependencies.randomOpaque(32);
  const replacementCsrf = dependencies.randomOpaque(32);
  const replacementSessionId = dependencies.createUuid();
  const replacementExpiresAt = addSeconds(now, dependencies.sessionTtlSeconds);
  const rotated = await dependencies.repository.rotateSession({
    currentSessionTokenSha256: session.sessionTokenSha256,
    replacement: {
      humanSubjectId: session.humanSubjectId,
      tenantId: session.tenantId,
      principalId: session.principalId,
      roles: session.roles,
      sessionId: replacementSessionId,
      sessionTokenSha256: sha256Hex(replacementToken),
      csrfSha256: sha256Hex(replacementCsrf),
      issuedAt: now,
      expiresAt: replacementExpiresAt,
      generation: session.generation + 1,
    },
  });
  if (!rotated) {
    throw new HumanSessionHttpError(
      401,
      "authentication_required",
      "Authentication required",
      "session_rejected",
      false,
      true
    );
  }
  try {
    await safeAudit(dependencies, {
      tenantId: session.tenantId,
      principalId: session.principalId,
      sessionId: replacementSessionId,
    }, requestIdValue, {
      eventType: "identity.human_session_rotated",
      outcome: "success",
      reasonCode: "session_rotated",
    });
  } catch {
    await dependencies.repository.revokeSession({
      sessionTokenSha256: sha256Hex(replacementToken),
      revokedAt: now,
    });
    throw new HumanSessionHttpError(500, "internal_error", "Unexpected server error", "session_rejected", false, true);
  }
  sendJson(res, 200, {
    authenticated: true,
    session_id: replacementSessionId,
    tenant_id: session.tenantId,
    principal_id: session.principalId,
    roles: session.roles,
    permissions: session.permissions,
    issued_at: now.toISOString(),
    expires_at: replacementExpiresAt.toISOString(),
    csrf_token: replacementCsrf,
    generation: session.generation + 1,
  }, requestIdValue, [
    cookie(
      dependencies.sessionCookieName,
      replacementToken,
      dependencies.sessionTtlSeconds,
      dependencies.secureCookies
    ),
  ]);
};

const handleRotate = async (
  req: IncomingMessage,
  res: ServerResponse,
  dependencies: HumanSessionBffDependencies,
  requestIdValue: string
): Promise<void> => {
  requireEnabled(dependencies);
  if (req.method !== "POST") {
    throw new HumanSessionHttpError(405, "method_not_allowed", "Method not allowed", "invalid_request");
  }
  ensureNoAuthorizationHeader(req);
  ensureNoRequestBody(req);
  const now = dependencies.now();
  const session = await authenticateRequest(req, dependencies, now);
  await requireMutationProof(req, dependencies, session, requestIdValue);
  const replacementToken = dependencies.randomOpaque(32);
  const replacementCsrf = dependencies.randomOpaque(32);
  const replacementSessionId = dependencies.createUuid();
  const rotated = await dependencies.repository.rotateSession({
    currentSessionTokenSha256: session.sessionTokenSha256,
    replacement: {
      humanSubjectId: session.humanSubjectId,
      tenantId: session.tenantId,
      principalId: session.principalId,
      roles: session.roles,
      sessionId: replacementSessionId,
      sessionTokenSha256: sha256Hex(replacementToken),
      csrfSha256: sha256Hex(replacementCsrf),
      issuedAt: now,
      expiresAt: addSeconds(now, dependencies.sessionTtlSeconds),
      generation: session.generation + 1,
    },
  });
  if (!rotated) {
    throw new HumanSessionHttpError(401, "authentication_required", "Authentication required", "session_rejected", false, true);
  }
  try {
    await safeAudit(
      dependencies,
      { tenantId: session.tenantId, principalId: session.principalId, sessionId: replacementSessionId },
      requestIdValue,
      {
        eventType: "identity.human_session_rotated",
        outcome: "success",
        reasonCode: "session_rotated",
      }
    );
  } catch {
    await dependencies.repository.revokeSession({
      sessionTokenSha256: sha256Hex(replacementToken),
      revokedAt: now,
    });
    throw new HumanSessionHttpError(500, "internal_error", "Unexpected server error", "session_rejected", false, true);
  }
  sendJson(res, 200, {
    rotated: true,
    session_id: replacementSessionId,
    csrf_token: replacementCsrf,
    generation: session.generation + 1,
  }, requestIdValue, [
    cookie(
      dependencies.sessionCookieName,
      replacementToken,
      dependencies.sessionTtlSeconds,
      dependencies.secureCookies
    ),
  ]);
};

const handleLogout = async (
  req: IncomingMessage,
  res: ServerResponse,
  dependencies: HumanSessionBffDependencies,
  requestIdValue: string
): Promise<void> => {
  requireEnabled(dependencies);
  if (req.method !== "POST") {
    throw new HumanSessionHttpError(405, "method_not_allowed", "Method not allowed", "invalid_request");
  }
  ensureNoAuthorizationHeader(req);
  ensureNoRequestBody(req);
  const now = dependencies.now();
  const session = await authenticateRequest(req, dependencies, now);
  await requireMutationProof(req, dependencies, session, requestIdValue);
  const revoked = await dependencies.repository.revokeSession({
    sessionTokenSha256: session.sessionTokenSha256,
    revokedAt: now,
  });
  if (!revoked) {
    throw new HumanSessionHttpError(401, "authentication_required", "Authentication required", "session_rejected", false, true);
  }
  try {
    await safeAudit(dependencies, session, requestIdValue, {
      eventType: "identity.human_logout_succeeded",
      outcome: "success",
      reasonCode: "logout_completed",
    });
  } catch {
    throw new HumanSessionHttpError(500, "internal_error", "Unexpected server error", "session_rejected", false, true);
  }
  sendJson(res, 200, { logged_out: true }, requestIdValue, [
    clearCookie(dependencies.sessionCookieName, dependencies.secureCookies),
  ]);
};

export const handleHumanSessionBff = async (
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  dependencies: HumanSessionBffDependencies
): Promise<boolean> => {
  if (!HUMAN_SESSION_ROUTES.has(url.pathname)) return false;
  const requestIdValue = requestId(req, dependencies);
  try {
    if (url.pathname === HUMAN_LOGIN_ROUTE) {
      await handleLogin(req, res, url, dependencies, requestIdValue);
    } else if (url.pathname === HUMAN_CALLBACK_ROUTE) {
      await handleCallback(req, res, url, dependencies, requestIdValue);
    } else if (url.pathname === HUMAN_SESSION_ROUTE) {
      await handleSession(req, res, dependencies, requestIdValue);
    } else if (url.pathname === HUMAN_SESSION_ROTATE_ROUTE) {
      await handleRotate(req, res, dependencies, requestIdValue);
    } else {
      await handleLogout(req, res, dependencies, requestIdValue);
    }
  } catch (error) {
    const safeError = error instanceof HumanSessionHttpError
      ? error
      : new HumanSessionHttpError(500, "internal_error", "Unexpected server error", "session_rejected", url.pathname === HUMAN_CALLBACK_ROUTE);
    await safeFailureAudit(dependencies, requestIdValue, safeError.reasonCode);
    const cookies = [
      ...(safeError.clearLoginCookie
        ? [clearCookie(dependencies.loginCookieName, dependencies.secureCookies)]
        : []),
      ...(safeError.clearSessionCookie
        ? [clearCookie(dependencies.sessionCookieName, dependencies.secureCookies)]
        : []),
    ];
    sendJson(
      res,
      safeError.statusCode,
      { error: { code: safeError.code, message: safeError.message } },
      requestIdValue,
      cookies
    );
  }
  return true;
};
