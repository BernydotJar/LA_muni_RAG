import type { Pool, QueryResultRow } from "pg";
import { pool as defaultPool } from "../db.js";
import { isSecurityRole } from "./rbac.js";
import type { CredentialPrincipalRecord, IdentityRepository } from "./types.js";

interface AuthenticationRow extends QueryResultRow {
  credential_id: string;
  tenant_id: string;
  principal_id: string;
  roles: unknown;
}

const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** Only the digest crosses the adapter boundary; the raw Bearer value never does. */
const AUTHENTICATE_CREDENTIAL_SQL = `
  SELECT credential_id, tenant_id, principal_id, roles
  FROM identity.authenticate_api_credential(decode($1, 'hex'));
`;

export class PostgresIdentityRepository implements IdentityRepository {
  constructor(private readonly db: Pick<Pool, "query"> = defaultPool) {}

  async authenticateByCredentialHash(
    credentialSha256: string
  ): Promise<CredentialPrincipalRecord | null> {
    if (!SHA256_HEX_PATTERN.test(credentialSha256)) return null;

    const result = await this.db.query<AuthenticationRow>(AUTHENTICATE_CREDENTIAL_SQL, [
      credentialSha256,
    ]);
    const row = result.rows[0];
    if (!row || result.rows.length !== 1 || !Array.isArray(row.roles) || !row.roles.every(isSecurityRole)) {
      return null;
    }

    return {
      credentialId: row.credential_id,
      tenantId: row.tenant_id,
      principalId: row.principal_id,
      roles: row.roles,
    };
  }
}
