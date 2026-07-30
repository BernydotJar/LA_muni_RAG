import { randomUUID } from "node:crypto";
import type { Pool, QueryResultRow } from "pg";
import { pool as defaultPool } from "../db.js";
import { isHumanSecurityRole, type HumanSecurityRole } from "../security/rbac.js";
import { isCanonicalUuid } from "../security/tenant.js";
import type {
  ConsumedLoginTransaction,
  CreateHumanSessionInput,
  HumanAuthenticationFailureReason,
  HumanMembershipRecord,
  HumanSessionAuditInput,
  HumanSessionRecord,
  HumanSessionRepository,
  LoginTransactionInput,
  RotateHumanSessionInput,
} from "./types.js";

const SHA256_HEX = /^[0-9a-f]{64}$/;
const PROVIDER_ID = /^[a-z][a-z0-9._-]{2,63}$/;

const assertDigest = (value: string): void => {
  if (!SHA256_HEX.test(value)) throw new Error("Invalid human session digest");
};

const assertProviderId = (value: string): void => {
  if (!PROVIDER_ID.test(value)) throw new Error("Invalid human identity provider ID");
};

const dateValue = (value: unknown): Date | null => {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed;
  }
  return null;
};

const validRoles = (value: unknown): value is HumanSecurityRole[] =>
  Array.isArray(value) && value.length > 0 && value.every(isHumanSecurityRole);

const cloneMembership = (record: HumanMembershipRecord): HumanMembershipRecord => ({
  humanSubjectId: record.humanSubjectId.toLowerCase(),
  tenantId: record.tenantId.toLowerCase(),
  principalId: record.principalId.toLowerCase(),
  roles: Object.freeze([...new Set(record.roles)]),
});

interface LoginTransactionState extends ConsumedLoginTransaction {
  stateSha256: string;
  browserBindingSha256: string;
  providerId: string;
  consumedAt: Date | null;
}

interface StoredSession extends HumanSessionRecord {
  sessionTokenSha256: string;
  revokedAt: Date | null;
  replacedBySessionId: string | null;
}

export class InMemoryHumanSessionRepository implements HumanSessionRepository {
  private readonly loginTransactions = new Map<string, LoginTransactionState>();
  private readonly authorizationCodes = new Map<string, Date>();
  private readonly memberships = new Map<string, HumanMembershipRecord[]>();
  private readonly sessions = new Map<string, StoredSession>();
  readonly audits: HumanSessionAuditInput[] = [];
  readonly authenticationFailures: Array<{
    requestId: string;
    reasonCode: HumanAuthenticationFailureReason;
  }> = [];

  constructor(
    membershipSeeds: ReadonlyArray<{
      providerId: string;
      issuerSha256: string;
      subjectSha256: string;
      membership: HumanMembershipRecord;
    }> = [],
    private readonly createUuid: () => string = randomUUID
  ) {
    for (const seed of membershipSeeds) this.addMembership(seed);
  }

  addMembership(seed: {
    providerId: string;
    issuerSha256: string;
    subjectSha256: string;
    membership: HumanMembershipRecord;
  }): void {
    assertProviderId(seed.providerId);
    assertDigest(seed.issuerSha256);
    assertDigest(seed.subjectSha256);
    const record = cloneMembership(seed.membership);
    if (
      !isCanonicalUuid(record.humanSubjectId) ||
      !isCanonicalUuid(record.tenantId) ||
      !isCanonicalUuid(record.principalId) ||
      !validRoles(record.roles)
    ) {
      throw new Error("Invalid human membership seed");
    }
    const key = `${seed.providerId}:${seed.issuerSha256}:${seed.subjectSha256}`;
    const records = this.memberships.get(key) ?? [];
    records.push(record);
    this.memberships.set(key, records);
  }

  async createLoginTransaction(input: LoginTransactionInput): Promise<string> {
    assertDigest(input.stateSha256);
    assertDigest(input.browserBindingSha256);
    assertProviderId(input.providerId);
    if (this.loginTransactions.has(input.stateSha256)) {
      throw new Error("Duplicate human login state");
    }
    const transactionId = this.createUuid();
    this.loginTransactions.set(input.stateSha256, {
      transactionId,
      stateSha256: input.stateSha256,
      browserBindingSha256: input.browserBindingSha256,
      providerId: input.providerId,
      protectedChallenge: input.protectedChallenge,
      returnPath: input.returnPath,
      expiresAt: new Date(input.expiresAt),
      consumedAt: null,
    });
    return transactionId;
  }

  async consumeLoginTransaction(input: {
    stateSha256: string;
    browserBindingSha256: string;
    providerId: string;
    now: Date;
  }): Promise<ConsumedLoginTransaction | null> {
    const record = this.loginTransactions.get(input.stateSha256);
    if (
      !record ||
      record.browserBindingSha256 !== input.browserBindingSha256 ||
      record.providerId !== input.providerId ||
      record.consumedAt ||
      record.expiresAt.getTime() <= input.now.getTime()
    ) {
      return null;
    }
    record.consumedAt = new Date(input.now);
    return {
      transactionId: record.transactionId,
      protectedChallenge: record.protectedChallenge,
      returnPath: record.returnPath,
      expiresAt: new Date(record.expiresAt),
    };
  }

  async claimAuthorizationCode(input: {
    providerId: string;
    codeSha256: string;
    expiresAt: Date;
  }): Promise<boolean> {
    assertProviderId(input.providerId);
    assertDigest(input.codeSha256);
    const key = `${input.providerId}:${input.codeSha256}`;
    if (this.authorizationCodes.has(key)) return false;
    this.authorizationCodes.set(key, new Date(input.expiresAt));
    return true;
  }

  async resolveHumanMembership(input: {
    providerId: string;
    issuerSha256: string;
    subjectSha256: string;
  }): Promise<HumanMembershipRecord | null> {
    const records = this.memberships.get(
      `${input.providerId}:${input.issuerSha256}:${input.subjectSha256}`
    );
    if (!records || records.length !== 1) return null;
    return cloneMembership(records[0]!);
  }

  async createSession(input: CreateHumanSessionInput): Promise<void> {
    assertDigest(input.sessionTokenSha256);
    assertDigest(input.csrfSha256);
    if (this.sessions.has(input.sessionTokenSha256)) throw new Error("Duplicate session token");
    this.sessions.set(input.sessionTokenSha256, {
      ...cloneMembership(input),
      sessionId: input.sessionId.toLowerCase(),
      issuedAt: new Date(input.issuedAt),
      expiresAt: new Date(input.expiresAt),
      csrfSha256: input.csrfSha256,
      generation: input.generation,
      sessionTokenSha256: input.sessionTokenSha256,
      revokedAt: null,
      replacedBySessionId: null,
    });
  }

  async authenticateSession(input: {
    sessionTokenSha256: string;
    now: Date;
  }): Promise<HumanSessionRecord | null> {
    const record = this.sessions.get(input.sessionTokenSha256);
    if (!record || record.revokedAt || record.expiresAt.getTime() <= input.now.getTime()) return null;
    return {
      ...cloneMembership(record),
      sessionId: record.sessionId,
      issuedAt: new Date(record.issuedAt),
      expiresAt: new Date(record.expiresAt),
      csrfSha256: record.csrfSha256,
      generation: record.generation,
    };
  }

  async rotateSession(input: RotateHumanSessionInput): Promise<boolean> {
    const current = this.sessions.get(input.currentSessionTokenSha256);
    if (!current || current.revokedAt || current.expiresAt.getTime() <= input.replacement.issuedAt.getTime()) {
      return false;
    }
    if (
      current.tenantId !== input.replacement.tenantId ||
      current.principalId !== input.replacement.principalId ||
      current.humanSubjectId !== input.replacement.humanSubjectId ||
      input.replacement.generation !== current.generation + 1
    ) {
      return false;
    }
    await this.createSession(input.replacement);
    current.revokedAt = new Date(input.replacement.issuedAt);
    current.replacedBySessionId = input.replacement.sessionId;
    return true;
  }

  async revokeSession(input: {
    sessionTokenSha256: string;
    revokedAt: Date;
  }): Promise<HumanSessionRecord | null> {
    const record = this.sessions.get(input.sessionTokenSha256);
    if (!record || record.revokedAt) return null;
    record.revokedAt = new Date(input.revokedAt);
    return {
      ...cloneMembership(record),
      sessionId: record.sessionId,
      issuedAt: new Date(record.issuedAt),
      expiresAt: new Date(record.expiresAt),
      csrfSha256: record.csrfSha256,
      generation: record.generation,
    };
  }

  async recordAudit(input: HumanSessionAuditInput): Promise<void> {
    this.audits.push({ ...input });
  }

  async recordAuthenticationFailure(input: {
    requestId: string;
    reasonCode: HumanAuthenticationFailureReason;
  }): Promise<void> {
    this.authenticationFailures.push({ ...input });
  }
}

interface LoginRow extends QueryResultRow {
  transaction_id: string;
  protected_challenge: string;
  return_path: string;
  expires_at: Date | string;
}

interface MembershipRow extends QueryResultRow {
  human_subject_id: string;
  tenant_id: string;
  principal_id: string;
  roles: unknown;
}

interface SessionRow extends MembershipRow {
  session_id: string;
  issued_at: Date | string;
  expires_at: Date | string;
  csrf_sha256: string;
  generation: number;
}

export class PostgresHumanSessionRepository implements HumanSessionRepository {
  constructor(private readonly db: Pick<Pool, "query"> = defaultPool) {}

  async createLoginTransaction(input: LoginTransactionInput): Promise<string> {
    const result = await this.db.query<{ transaction_id: string }>(
      "SELECT identity.create_human_login_transaction(decode($1, 'hex'), decode($2, 'hex'), $3, $4, $5, $6) AS transaction_id",
      [
        input.stateSha256,
        input.browserBindingSha256,
        input.providerId,
        input.protectedChallenge,
        input.returnPath,
        input.expiresAt,
      ]
    );
    const id = result.rows[0]?.transaction_id;
    if (!isCanonicalUuid(id)) throw new Error("Human login transaction creation failed");
    return id.toLowerCase();
  }

  async consumeLoginTransaction(input: {
    stateSha256: string;
    browserBindingSha256: string;
    providerId: string;
    now: Date;
  }): Promise<ConsumedLoginTransaction | null> {
    const result = await this.db.query<LoginRow>(
      "SELECT * FROM identity.consume_human_login_transaction(decode($1, 'hex'), decode($2, 'hex'), $3, $4)",
      [input.stateSha256, input.browserBindingSha256, input.providerId, input.now]
    );
    const row = result.rows[0];
    const expiresAt = dateValue(row?.expires_at);
    if (!row || result.rows.length !== 1 || !isCanonicalUuid(row.transaction_id) || !expiresAt) return null;
    return {
      transactionId: row.transaction_id.toLowerCase(),
      protectedChallenge: row.protected_challenge,
      returnPath: row.return_path,
      expiresAt,
    };
  }

  async claimAuthorizationCode(input: {
    providerId: string;
    codeSha256: string;
    expiresAt: Date;
  }): Promise<boolean> {
    const result = await this.db.query<{ claimed: boolean }>(
      "SELECT identity.claim_human_authorization_code($1, decode($2, 'hex'), $3) AS claimed",
      [input.providerId, input.codeSha256, input.expiresAt]
    );
    return result.rows.length === 1 && result.rows[0]?.claimed === true;
  }

  async resolveHumanMembership(input: {
    providerId: string;
    issuerSha256: string;
    subjectSha256: string;
  }): Promise<HumanMembershipRecord | null> {
    const result = await this.db.query<MembershipRow>(
      "SELECT * FROM identity.resolve_human_membership($1, decode($2, 'hex'), decode($3, 'hex'))",
      [input.providerId, input.issuerSha256, input.subjectSha256]
    );
    const row = result.rows[0];
    if (
      !row ||
      result.rows.length !== 1 ||
      !isCanonicalUuid(row.human_subject_id) ||
      !isCanonicalUuid(row.tenant_id) ||
      !isCanonicalUuid(row.principal_id) ||
      !validRoles(row.roles)
    ) {
      return null;
    }
    return cloneMembership({
      humanSubjectId: row.human_subject_id,
      tenantId: row.tenant_id,
      principalId: row.principal_id,
      roles: row.roles,
    });
  }

  async createSession(input: CreateHumanSessionInput): Promise<void> {
    const result = await this.db.query<{ created: boolean }>(
      "SELECT identity.create_human_session($1, $2, $3, $4, decode($5, 'hex'), decode($6, 'hex'), $7, $8, $9) AS created",
      [
        input.sessionId,
        input.tenantId,
        input.principalId,
        input.humanSubjectId,
        input.sessionTokenSha256,
        input.csrfSha256,
        input.issuedAt,
        input.expiresAt,
        input.generation,
      ]
    );
    if (result.rows.length !== 1 || result.rows[0]?.created !== true) {
      throw new Error("Human session creation failed");
    }
  }

  async authenticateSession(input: {
    sessionTokenSha256: string;
    now: Date;
  }): Promise<HumanSessionRecord | null> {
    const result = await this.db.query<SessionRow>(
      "SELECT * FROM identity.authenticate_human_session(decode($1, 'hex'), $2)",
      [input.sessionTokenSha256, input.now]
    );
    return this.mapSession(result.rows);
  }

  async rotateSession(input: RotateHumanSessionInput): Promise<boolean> {
    const replacement = input.replacement;
    const result = await this.db.query<{ rotated: boolean }>(
      "SELECT identity.rotate_human_session(decode($1, 'hex'), $2, decode($3, 'hex'), decode($4, 'hex'), $5, $6, $7) AS rotated",
      [
        input.currentSessionTokenSha256,
        replacement.sessionId,
        replacement.sessionTokenSha256,
        replacement.csrfSha256,
        replacement.issuedAt,
        replacement.expiresAt,
        replacement.generation,
      ]
    );
    return result.rows.length === 1 && result.rows[0]?.rotated === true;
  }

  async revokeSession(input: {
    sessionTokenSha256: string;
    revokedAt: Date;
  }): Promise<HumanSessionRecord | null> {
    const result = await this.db.query<SessionRow>(
      "SELECT * FROM identity.revoke_human_session(decode($1, 'hex'), $2)",
      [input.sessionTokenSha256, input.revokedAt]
    );
    return this.mapSession(result.rows);
  }

  async recordAudit(input: HumanSessionAuditInput): Promise<void> {
    await this.db.query(
      "SELECT identity.record_human_session_audit($1, $2, $3, $4, $5, $6, $7)",
      [
        input.tenantId,
        input.principalId,
        input.sessionId,
        input.requestId,
        input.eventType,
        input.outcome,
        input.reasonCode,
      ]
    );
  }

  async recordAuthenticationFailure(input: {
    requestId: string;
    reasonCode: HumanAuthenticationFailureReason;
  }): Promise<void> {
    await this.db.query("SELECT identity.record_human_auth_failure($1, $2)", [
      input.requestId,
      input.reasonCode,
    ]);
  }

  private mapSession(rows: SessionRow[]): HumanSessionRecord | null {
    const row = rows[0];
    const issuedAt = dateValue(row?.issued_at);
    const expiresAt = dateValue(row?.expires_at);
    if (
      !row ||
      rows.length !== 1 ||
      !issuedAt ||
      !expiresAt ||
      !isCanonicalUuid(row.session_id) ||
      !isCanonicalUuid(row.human_subject_id) ||
      !isCanonicalUuid(row.tenant_id) ||
      !isCanonicalUuid(row.principal_id) ||
      !validRoles(row.roles) ||
      !SHA256_HEX.test(row.csrf_sha256) ||
      !Number.isSafeInteger(row.generation) ||
      row.generation < 1
    ) {
      return null;
    }
    return {
      ...cloneMembership({
        humanSubjectId: row.human_subject_id,
        tenantId: row.tenant_id,
        principalId: row.principal_id,
        roles: row.roles,
      }),
      sessionId: row.session_id.toLowerCase(),
      issuedAt,
      expiresAt,
      csrfSha256: row.csrf_sha256,
      generation: row.generation,
    };
  }
}
