-- LA Muni RAG
-- Feature 077: provider-neutral human identity and BFF session foundation.
--
-- OIDC claims are never application authorization. This migration persists only
-- opaque provider/subject digests, locally governed tenant memberships, protected
-- login challenges, one-way token/CSRF/code digests, bounded timestamps, and
-- minimized audit metadata. It creates no provider configuration or credential.

BEGIN;

CREATE TABLE identity.human_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
  principal_id UUID NOT NULL,
  provider_id TEXT NOT NULL CHECK (provider_id ~ '^[a-z][a-z0-9._-]{2,63}$'),
  issuer_sha256 BYTEA NOT NULL CHECK (octet_length(issuer_sha256) = 32),
  subject_sha256 BYTEA NOT NULL CHECK (octet_length(subject_sha256) = 32),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  UNIQUE (id, tenant_id),
  UNIQUE (provider_id, issuer_sha256, subject_sha256, tenant_id),
  FOREIGN KEY (principal_id, tenant_id)
    REFERENCES identity.principals(id, tenant_id) ON DELETE CASCADE
);

CREATE INDEX human_subjects_lookup_idx
  ON identity.human_subjects (provider_id, issuer_sha256, subject_sha256)
  WHERE status = 'active';

CREATE TABLE identity.human_login_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_sha256 BYTEA NOT NULL UNIQUE CHECK (octet_length(state_sha256) = 32),
  browser_binding_sha256 BYTEA NOT NULL CHECK (octet_length(browser_binding_sha256) = 32),
  provider_id TEXT NOT NULL CHECK (provider_id ~ '^[a-z][a-z0-9._-]{2,63}$'),
  protected_challenge TEXT NOT NULL
    CHECK (octet_length(protected_challenge) BETWEEN 40 AND 8192 AND protected_challenge !~ '[[:cntrl:]]'),
  return_path TEXT NOT NULL
    CHECK (return_path ~ '^/[^?#[:cntrl:]]{0,199}$' AND return_path !~ '^//'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  CHECK (expires_at > created_at),
  CHECK (consumed_at IS NULL OR consumed_at >= created_at)
);

CREATE INDEX human_login_transactions_expiry_idx
  ON identity.human_login_transactions (expires_at);

CREATE TABLE identity.human_authorization_code_claims (
  provider_id TEXT NOT NULL CHECK (provider_id ~ '^[a-z][a-z0-9._-]{2,63}$'),
  code_sha256 BYTEA NOT NULL CHECK (octet_length(code_sha256) = 32),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (provider_id, code_sha256),
  CHECK (expires_at > claimed_at)
);

CREATE INDEX human_authorization_code_claims_expiry_idx
  ON identity.human_authorization_code_claims (expires_at);

CREATE TABLE identity.human_sessions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
  principal_id UUID NOT NULL,
  human_subject_id UUID NOT NULL,
  session_token_sha256 BYTEA NOT NULL UNIQUE CHECK (octet_length(session_token_sha256) = 32),
  csrf_sha256 BYTEA NOT NULL CHECK (octet_length(csrf_sha256) = 32),
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  replaced_by_session_id UUID,
  generation INTEGER NOT NULL CHECK (generation BETWEEN 1 AND 1000000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  UNIQUE (id, tenant_id),
  FOREIGN KEY (principal_id, tenant_id)
    REFERENCES identity.principals(id, tenant_id) ON DELETE CASCADE,
  FOREIGN KEY (human_subject_id, tenant_id)
    REFERENCES identity.human_subjects(id, tenant_id) ON DELETE CASCADE,
  FOREIGN KEY (replaced_by_session_id, tenant_id)
    REFERENCES identity.human_sessions(id, tenant_id) DEFERRABLE INITIALLY DEFERRED,
  CHECK (expires_at > issued_at),
  CHECK (expires_at <= issued_at + interval '8 hours'),
  CHECK (revoked_at IS NULL OR revoked_at >= issued_at),
  CHECK ((revoked_at IS NULL AND replaced_by_session_id IS NULL)
    OR revoked_at IS NOT NULL)
);

CREATE INDEX human_sessions_tenant_principal_idx
  ON identity.human_sessions (tenant_id, principal_id, expires_at DESC);
CREATE INDEX human_sessions_expiry_idx
  ON identity.human_sessions (expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE identity.human_auth_failure_buckets (
  window_started_at TIMESTAMPTZ NOT NULL,
  reason_code TEXT NOT NULL CHECK (reason_code IN (
    'invalid_request', 'state_rejected', 'code_replay', 'provider_rejected',
    'membership_rejected', 'session_rejected', 'csrf_rejected'
  )),
  failure_count INTEGER NOT NULL DEFAULT 1 CHECK (failure_count BETWEEN 1 AND 1000000),
  first_request_id UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  PRIMARY KEY (window_started_at, reason_code)
);

ALTER TABLE identity.human_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.human_subjects FORCE ROW LEVEL SECURITY;
CREATE POLICY human_subjects_tenant_isolation ON identity.human_subjects
  FOR ALL
  USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

ALTER TABLE identity.human_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.human_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY human_sessions_tenant_isolation ON identity.human_sessions
  FOR ALL
  USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

CREATE FUNCTION identity.create_human_login_transaction(
  requested_state_sha256 BYTEA,
  requested_browser_binding_sha256 BYTEA,
  requested_provider_id TEXT,
  requested_protected_challenge TEXT,
  requested_return_path TEXT,
  requested_expires_at TIMESTAMPTZ
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  created_id UUID;
BEGIN
  IF octet_length(requested_state_sha256) <> 32
    OR octet_length(requested_browser_binding_sha256) <> 32
    OR requested_provider_id !~ '^[a-z][a-z0-9._-]{2,63}$'
    OR octet_length(requested_protected_challenge) NOT BETWEEN 40 AND 8192
    OR requested_protected_challenge ~ '[[:cntrl:]]'
    OR requested_return_path !~ '^/[^?#[:cntrl:]]{0,199}$'
    OR requested_return_path ~ '^//'
    OR requested_expires_at <= statement_timestamp()
    OR requested_expires_at > statement_timestamp() + interval '10 minutes'
  THEN
    RAISE EXCEPTION 'invalid human login transaction';
  END IF;

  DELETE FROM identity.human_login_transactions
  WHERE expires_at <= statement_timestamp()
     OR consumed_at < statement_timestamp() - interval '10 minutes';

  INSERT INTO identity.human_login_transactions (
    state_sha256, browser_binding_sha256, provider_id,
    protected_challenge, return_path, expires_at
  ) VALUES (
    requested_state_sha256, requested_browser_binding_sha256, requested_provider_id,
    requested_protected_challenge, requested_return_path, requested_expires_at
  ) RETURNING id INTO created_id;

  RETURN created_id;
END;
$function$;

CREATE FUNCTION identity.consume_human_login_transaction(
  requested_state_sha256 BYTEA,
  requested_browser_binding_sha256 BYTEA,
  requested_provider_id TEXT,
  requested_now TIMESTAMPTZ
) RETURNS TABLE (
  transaction_id UUID,
  protected_challenge TEXT,
  return_path TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  UPDATE identity.human_login_transactions
  SET consumed_at = requested_now
  WHERE state_sha256 = requested_state_sha256
    AND browser_binding_sha256 = requested_browser_binding_sha256
    AND provider_id = requested_provider_id
    AND consumed_at IS NULL
    AND expires_at > requested_now
    AND requested_now BETWEEN statement_timestamp() - interval '5 minutes'
      AND statement_timestamp() + interval '5 minutes'
    AND octet_length(requested_state_sha256) = 32
    AND octet_length(requested_browser_binding_sha256) = 32
  RETURNING id, protected_challenge, return_path, expires_at;
$function$;

CREATE FUNCTION identity.claim_human_authorization_code(
  requested_provider_id TEXT,
  requested_code_sha256 BYTEA,
  requested_expires_at TIMESTAMPTZ
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  inserted_count INTEGER;
BEGIN
  IF requested_provider_id !~ '^[a-z][a-z0-9._-]{2,63}$'
    OR octet_length(requested_code_sha256) <> 32
    OR requested_expires_at <= statement_timestamp()
    OR requested_expires_at > statement_timestamp() + interval '1 hour'
  THEN
    RETURN FALSE;
  END IF;

  DELETE FROM identity.human_authorization_code_claims
  WHERE expires_at <= statement_timestamp();

  INSERT INTO identity.human_authorization_code_claims (
    provider_id, code_sha256, expires_at
  ) VALUES (
    requested_provider_id, requested_code_sha256, requested_expires_at
  ) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count = 1;
END;
$function$;

CREATE FUNCTION identity.resolve_human_membership(
  requested_provider_id TEXT,
  requested_issuer_sha256 BYTEA,
  requested_subject_sha256 BYTEA
) RETURNS TABLE (
  human_subject_id UUID,
  tenant_id UUID,
  principal_id UUID,
  roles TEXT[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT
    human_subject.id,
    human_subject.tenant_id,
    principal.id,
    array_agg(membership.role::text ORDER BY membership.role::text)
  FROM identity.human_subjects AS human_subject
  JOIN identity.principals AS principal
    ON principal.id = human_subject.principal_id
   AND principal.tenant_id = human_subject.tenant_id
  JOIN identity.tenants AS tenant
    ON tenant.id = human_subject.tenant_id
  JOIN identity.memberships AS membership
    ON membership.principal_id = principal.id
   AND membership.tenant_id = principal.tenant_id
  WHERE human_subject.provider_id = requested_provider_id
    AND human_subject.issuer_sha256 = requested_issuer_sha256
    AND human_subject.subject_sha256 = requested_subject_sha256
    AND octet_length(requested_issuer_sha256) = 32
    AND octet_length(requested_subject_sha256) = 32
    AND human_subject.status = 'active'
    AND principal.status = 'active'
    AND principal.principal_kind = 'user'
    AND tenant.status = 'active'
    AND membership.role::text <> 'integration_client'
  GROUP BY human_subject.id, human_subject.tenant_id, principal.id;
$function$;

CREATE FUNCTION identity.create_human_session(
  requested_session_id UUID,
  requested_tenant_id UUID,
  requested_principal_id UUID,
  requested_human_subject_id UUID,
  requested_session_token_sha256 BYTEA,
  requested_csrf_sha256 BYTEA,
  requested_issued_at TIMESTAMPTZ,
  requested_expires_at TIMESTAMPTZ,
  requested_generation INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF octet_length(requested_session_token_sha256) <> 32
    OR octet_length(requested_csrf_sha256) <> 32
    OR requested_generation <> 1
    OR requested_issued_at NOT BETWEEN statement_timestamp() - interval '5 minutes'
      AND statement_timestamp() + interval '5 minutes'
    OR requested_expires_at <= requested_issued_at
    OR requested_expires_at > requested_issued_at + interval '8 hours'
    OR NOT EXISTS (
      SELECT 1
      FROM identity.human_subjects AS human_subject
      JOIN identity.principals AS principal
        ON principal.id = human_subject.principal_id
       AND principal.tenant_id = human_subject.tenant_id
      JOIN identity.tenants AS tenant ON tenant.id = human_subject.tenant_id
      JOIN identity.memberships AS membership
        ON membership.principal_id = principal.id
       AND membership.tenant_id = principal.tenant_id
      WHERE human_subject.id = requested_human_subject_id
        AND human_subject.tenant_id = requested_tenant_id
        AND human_subject.principal_id = requested_principal_id
        AND human_subject.status = 'active'
        AND principal.status = 'active'
        AND principal.principal_kind = 'user'
        AND tenant.status = 'active'
        AND membership.role::text <> 'integration_client'
    )
  THEN
    RETURN FALSE;
  END IF;

  INSERT INTO identity.human_sessions (
    id, tenant_id, principal_id, human_subject_id,
    session_token_sha256, csrf_sha256, issued_at, expires_at, generation
  ) VALUES (
    requested_session_id, requested_tenant_id, requested_principal_id, requested_human_subject_id,
    requested_session_token_sha256, requested_csrf_sha256,
    requested_issued_at, requested_expires_at, requested_generation
  );
  RETURN TRUE;
END;
$function$;

CREATE FUNCTION identity.authenticate_human_session(
  requested_session_token_sha256 BYTEA,
  requested_now TIMESTAMPTZ
) RETURNS TABLE (
  session_id UUID,
  human_subject_id UUID,
  tenant_id UUID,
  principal_id UUID,
  roles TEXT[],
  issued_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  csrf_sha256 TEXT,
  generation INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT
    session.id,
    session.human_subject_id,
    session.tenant_id,
    session.principal_id,
    array_agg(membership.role::text ORDER BY membership.role::text),
    session.issued_at,
    session.expires_at,
    encode(session.csrf_sha256, 'hex'),
    session.generation
  FROM identity.human_sessions AS session
  JOIN identity.human_subjects AS human_subject
    ON human_subject.id = session.human_subject_id
   AND human_subject.tenant_id = session.tenant_id
   AND human_subject.principal_id = session.principal_id
  JOIN identity.principals AS principal
    ON principal.id = session.principal_id
   AND principal.tenant_id = session.tenant_id
  JOIN identity.tenants AS tenant ON tenant.id = session.tenant_id
  JOIN identity.memberships AS membership
    ON membership.principal_id = principal.id
   AND membership.tenant_id = principal.tenant_id
  WHERE octet_length(requested_session_token_sha256) = 32
    AND session.session_token_sha256 = requested_session_token_sha256
    AND session.revoked_at IS NULL
    AND session.expires_at > requested_now
    AND requested_now BETWEEN statement_timestamp() - interval '5 minutes'
      AND statement_timestamp() + interval '5 minutes'
    AND human_subject.status = 'active'
    AND principal.status = 'active'
    AND principal.principal_kind = 'user'
    AND tenant.status = 'active'
    AND membership.role::text <> 'integration_client'
  GROUP BY session.id, session.human_subject_id, session.tenant_id,
    session.principal_id, session.issued_at, session.expires_at,
    session.csrf_sha256, session.generation;
$function$;

CREATE FUNCTION identity.rotate_human_session(
  requested_current_token_sha256 BYTEA,
  requested_replacement_session_id UUID,
  requested_replacement_token_sha256 BYTEA,
  requested_replacement_csrf_sha256 BYTEA,
  requested_issued_at TIMESTAMPTZ,
  requested_expires_at TIMESTAMPTZ,
  requested_generation INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  current_session identity.human_sessions%ROWTYPE;
BEGIN
  IF octet_length(requested_current_token_sha256) <> 32
    OR octet_length(requested_replacement_token_sha256) <> 32
    OR octet_length(requested_replacement_csrf_sha256) <> 32
    OR requested_issued_at NOT BETWEEN statement_timestamp() - interval '5 minutes'
      AND statement_timestamp() + interval '5 minutes'
    OR requested_expires_at <= requested_issued_at
    OR requested_expires_at > requested_issued_at + interval '8 hours'
  THEN
    RETURN FALSE;
  END IF;

  SELECT * INTO current_session
  FROM identity.human_sessions
  WHERE session_token_sha256 = requested_current_token_sha256
  FOR UPDATE;

  IF NOT FOUND
    OR current_session.revoked_at IS NOT NULL
    OR current_session.expires_at <= requested_issued_at
    OR requested_generation <> current_session.generation + 1
  THEN
    RETURN FALSE;
  END IF;

  INSERT INTO identity.human_sessions (
    id, tenant_id, principal_id, human_subject_id,
    session_token_sha256, csrf_sha256, issued_at, expires_at, generation
  ) VALUES (
    requested_replacement_session_id,
    current_session.tenant_id,
    current_session.principal_id,
    current_session.human_subject_id,
    requested_replacement_token_sha256,
    requested_replacement_csrf_sha256,
    requested_issued_at,
    requested_expires_at,
    requested_generation
  );

  UPDATE identity.human_sessions
  SET revoked_at = requested_issued_at,
      replaced_by_session_id = requested_replacement_session_id
  WHERE id = current_session.id;

  RETURN TRUE;
END;
$function$;

CREATE FUNCTION identity.revoke_human_session(
  requested_session_token_sha256 BYTEA,
  requested_revoked_at TIMESTAMPTZ
) RETURNS TABLE (
  session_id UUID,
  human_subject_id UUID,
  tenant_id UUID,
  principal_id UUID,
  roles TEXT[],
  issued_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  csrf_sha256 TEXT,
  generation INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  revoked_session identity.human_sessions%ROWTYPE;
BEGIN
  UPDATE identity.human_sessions
  SET revoked_at = requested_revoked_at
  WHERE session_token_sha256 = requested_session_token_sha256
    AND revoked_at IS NULL
    AND requested_revoked_at BETWEEN statement_timestamp() - interval '5 minutes'
      AND statement_timestamp() + interval '5 minutes'
    AND octet_length(requested_session_token_sha256) = 32
  RETURNING * INTO revoked_session;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    revoked_session.id,
    revoked_session.human_subject_id,
    revoked_session.tenant_id,
    revoked_session.principal_id,
    array_agg(membership.role::text ORDER BY membership.role::text),
    revoked_session.issued_at,
    revoked_session.expires_at,
    encode(revoked_session.csrf_sha256, 'hex'),
    revoked_session.generation
  FROM identity.memberships AS membership
  WHERE membership.tenant_id = revoked_session.tenant_id
    AND membership.principal_id = revoked_session.principal_id
    AND membership.role::text <> 'integration_client'
  GROUP BY revoked_session.id, revoked_session.human_subject_id,
    revoked_session.tenant_id, revoked_session.principal_id,
    revoked_session.issued_at, revoked_session.expires_at,
    revoked_session.csrf_sha256, revoked_session.generation;
END;
$function$;

CREATE FUNCTION identity.record_human_session_audit(
  requested_tenant_id UUID,
  requested_principal_id UUID,
  requested_session_id UUID,
  requested_request_id UUID,
  requested_event_type TEXT,
  requested_outcome TEXT,
  requested_reason_code TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF requested_event_type NOT IN (
      'identity.human_login_succeeded',
      'identity.human_session_authenticated',
      'identity.human_session_rotated',
      'identity.human_logout_succeeded',
      'identity.human_session_denied'
    )
    OR requested_outcome NOT IN ('success', 'blocked')
    OR requested_reason_code NOT IN (
      'login_completed', 'session_valid', 'session_rotated',
      'logout_completed', 'session_rejected', 'csrf_rejected'
    )
    OR NOT EXISTS (
      SELECT 1 FROM identity.human_sessions AS session
      WHERE session.id = requested_session_id
        AND session.tenant_id = requested_tenant_id
        AND session.principal_id = requested_principal_id
    )
  THEN
    RAISE EXCEPTION 'invalid human session audit input';
  END IF;

  INSERT INTO audit.events (
    tenant_id, actor_external_id, event_type, entity_schema,
    entity_table, entity_id, outcome, details
  ) VALUES (
    requested_tenant_id,
    requested_principal_id::text,
    requested_event_type,
    'identity',
    'human_sessions',
    requested_session_id,
    requested_outcome,
    jsonb_build_object(
      'reasonCode', requested_reason_code,
      'requestId', requested_request_id::text,
      'sessionId', requested_session_id::text
    )
  );
END;
$function$;

CREATE FUNCTION identity.record_human_auth_failure(
  requested_request_id UUID,
  requested_reason_code TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  bucket_start TIMESTAMPTZ := date_trunc('minute', statement_timestamp());
BEGIN
  IF requested_reason_code NOT IN (
    'invalid_request', 'state_rejected', 'code_replay', 'provider_rejected',
    'membership_rejected', 'session_rejected', 'csrf_rejected'
  ) THEN
    RAISE EXCEPTION 'invalid human authentication failure input';
  END IF;

  DELETE FROM identity.human_auth_failure_buckets
  WHERE window_started_at < statement_timestamp() - interval '30 days';

  INSERT INTO identity.human_auth_failure_buckets (
    window_started_at, reason_code, failure_count, first_request_id, updated_at
  ) VALUES (
    bucket_start, requested_reason_code, 1, requested_request_id, statement_timestamp()
  )
  ON CONFLICT (window_started_at, reason_code) DO UPDATE
  SET failure_count = LEAST(identity.human_auth_failure_buckets.failure_count + 1, 1000000),
      updated_at = statement_timestamp();
END;
$function$;

REVOKE ALL ON TABLE
  identity.human_subjects,
  identity.human_login_transactions,
  identity.human_authorization_code_claims,
  identity.human_sessions,
  identity.human_auth_failure_buckets
FROM PUBLIC;

REVOKE ALL ON FUNCTION identity.create_human_login_transaction(BYTEA, BYTEA, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION identity.consume_human_login_transaction(BYTEA, BYTEA, TEXT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION identity.claim_human_authorization_code(TEXT, BYTEA, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION identity.resolve_human_membership(TEXT, BYTEA, BYTEA) FROM PUBLIC;
REVOKE ALL ON FUNCTION identity.create_human_session(UUID, UUID, UUID, UUID, BYTEA, BYTEA, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION identity.authenticate_human_session(BYTEA, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION identity.rotate_human_session(BYTEA, UUID, BYTEA, BYTEA, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION identity.revoke_human_session(BYTEA, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION identity.record_human_session_audit(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION identity.record_human_auth_failure(UUID, TEXT) FROM PUBLIC;

COMMENT ON TABLE identity.human_subjects IS
  'Provider-neutral opaque subject digests mapped to local user principals; provider claims never grant tenant roles.';
COMMENT ON TABLE identity.human_login_transactions IS
  'Single-use state and browser-binding digests with a protected nonce/PKCE challenge; no raw state, nonce or verifier.';
COMMENT ON TABLE identity.human_sessions IS
  'Rotatable, revocable BFF sessions containing only token and CSRF digests; raw cookies are never persisted.';
COMMENT ON TABLE identity.human_auth_failure_buckets IS
  'Bounded pre-tenant failure aggregates without codes, cookies, tokens, subjects, issuer values or PII.';

COMMIT;
