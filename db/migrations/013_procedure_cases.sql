-- LA Muni RAG
-- WS-06 tenant-scoped procedure case system of record.
-- Cases bind immutably to a workflow version that was approved at creation time.
-- Operational completion and validation states never represent legal sufficiency,
-- municipal approval, reception, payment, liquidation, or institutional closure.

BEGIN;

CREATE TABLE rag.procedure_cases (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  case_key TEXT NOT NULL,
  workflow_version_id UUID NOT NULL,
  workflow_version_number INTEGER NOT NULL CHECK (workflow_version_number > 0),
  jurisdiction TEXT NOT NULL,
  subject_reference TEXT,
  community_reference TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'blocked', 'ready_for_review', 'closed')),
  validation_state TEXT NOT NULL DEFAULT 'unreviewed'
    CHECK (validation_state IN ('unreviewed', 'in_review', 'validated', 'changes_required')),
  current_step_id TEXT,
  follow_up_at TIMESTAMPTZ,
  operational_note TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_by_principal_id UUID NOT NULL,
  updated_by_principal_id UUID NOT NULL,
  create_request_sha256 BYTEA NOT NULL CHECK (octet_length(create_request_sha256) = 32),
  initial_response_status INTEGER CHECK (initial_response_status IS NULL OR initial_response_status = 201),
  initial_response_body TEXT,
  initial_response_sha256 BYTEA CHECK (initial_response_sha256 IS NULL OR octet_length(initial_response_sha256) = 32),
  initial_audit_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  UNIQUE (id, tenant_id),
  UNIQUE (tenant_id, case_key),
  UNIQUE (tenant_id, created_by_principal_id, create_request_sha256),
  FOREIGN KEY (tenant_id) REFERENCES identity.tenants(id) ON DELETE RESTRICT,
  FOREIGN KEY (workflow_version_id, tenant_id)
    REFERENCES rag.procedure_versions(id, tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by_principal_id, tenant_id)
    REFERENCES identity.principals(id, tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (updated_by_principal_id, tenant_id)
    REFERENCES identity.principals(id, tenant_id) ON DELETE RESTRICT,
  CHECK (case_key ~ '^[a-z0-9][a-z0-9._:-]{2,127}$'),
  CHECK (char_length(jurisdiction) BETWEEN 1 AND 500 AND jurisdiction !~ '[[:cntrl:]]'),
  CHECK (subject_reference IS NULL OR (char_length(subject_reference) BETWEEN 1 AND 200 AND subject_reference !~ '[[:cntrl:]]')),
  CHECK (community_reference IS NULL OR (char_length(community_reference) BETWEEN 1 AND 200 AND community_reference !~ '[[:cntrl:]]')),
  CHECK (current_step_id IS NULL OR current_step_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  CHECK (operational_note IS NULL OR (char_length(operational_note) BETWEEN 1 AND 4000 AND operational_note !~ '[[:cntrl:]]')),
  CHECK (
    (initial_response_status IS NULL AND initial_response_body IS NULL AND initial_response_sha256 IS NULL AND initial_audit_id IS NULL)
    OR
    (initial_response_status = 201 AND initial_response_body IS NOT NULL
      AND octet_length(initial_response_body) BETWEEN 2 AND 1048576
      AND initial_response_sha256 = public.digest(initial_response_body, 'sha256')
      AND initial_audit_id IS NOT NULL)
  )
);

CREATE TABLE rag.procedure_case_steps (
  case_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  step_id TEXT NOT NULL,
  title TEXT NOT NULL,
  ordinal INTEGER NOT NULL CHECK (ordinal > 0 AND ordinal <= 100),
  state TEXT NOT NULL DEFAULT 'not_started'
    CHECK (state IN ('not_started', 'in_progress', 'blocked', 'ready_for_review', 'completed')),
  updated_by_principal_id UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  PRIMARY KEY (tenant_id, case_id, step_id),
  FOREIGN KEY (case_id, tenant_id)
    REFERENCES rag.procedure_cases(id, tenant_id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by_principal_id, tenant_id)
    REFERENCES identity.principals(id, tenant_id) ON DELETE RESTRICT,
  CHECK (step_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  CHECK (char_length(title) BETWEEN 1 AND 300 AND title !~ '[[:cntrl:]]')
);

CREATE TABLE rag.procedure_case_documents (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  case_id UUID NOT NULL,
  requirement_id TEXT NOT NULL,
  document_version_id UUID,
  state TEXT NOT NULL
    CHECK (state IN ('missing', 'requested', 'received', 'reviewed')),
  note TEXT,
  updated_by_principal_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  UNIQUE (id, tenant_id),
  UNIQUE (tenant_id, case_id, requirement_id),
  FOREIGN KEY (case_id, tenant_id)
    REFERENCES rag.procedure_cases(id, tenant_id) ON DELETE CASCADE,
  FOREIGN KEY (document_version_id, tenant_id)
    REFERENCES rag.document_versions(id, tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (updated_by_principal_id, tenant_id)
    REFERENCES identity.principals(id, tenant_id) ON DELETE RESTRICT,
  CHECK (requirement_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  CHECK (note IS NULL OR (char_length(note) BETWEEN 1 AND 1000 AND note !~ '[[:cntrl:]]')),
  CHECK (state IN ('missing', 'requested') OR document_version_id IS NOT NULL)
);

CREATE TABLE rag.procedure_case_blockers (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  case_id UUID NOT NULL,
  blocker_code TEXT NOT NULL,
  description TEXT NOT NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by_principal_id UUID,
  created_by_principal_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  UNIQUE (id, tenant_id),
  FOREIGN KEY (case_id, tenant_id)
    REFERENCES rag.procedure_cases(id, tenant_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_principal_id, tenant_id)
    REFERENCES identity.principals(id, tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (resolved_by_principal_id, tenant_id)
    REFERENCES identity.principals(id, tenant_id) ON DELETE RESTRICT,
  CHECK (blocker_code ~ '^[a-z][a-z0-9_]{0,63}$'),
  CHECK (char_length(description) BETWEEN 1 AND 1000 AND description !~ '[[:cntrl:]]'),
  CHECK ((resolved_at IS NULL) = (resolved_by_principal_id IS NULL))
);

CREATE TABLE rag.procedure_case_events (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  case_id UUID NOT NULL,
  actor_principal_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  UNIQUE (id, tenant_id),
  FOREIGN KEY (case_id, tenant_id)
    REFERENCES rag.procedure_cases(id, tenant_id) ON DELETE CASCADE,
  FOREIGN KEY (actor_principal_id, tenant_id)
    REFERENCES identity.principals(id, tenant_id) ON DELETE RESTRICT,
  CHECK (event_type ~ '^procedure_case\.[a-z][a-z0-9_]{0,63}$'),
  CHECK (jsonb_typeof(details) = 'object'),
  CHECK (octet_length(details::text) <= 8192)
);

CREATE INDEX procedure_cases_status_idx
  ON rag.procedure_cases (tenant_id, status, follow_up_at, updated_at DESC);
CREATE INDEX procedure_case_steps_state_idx
  ON rag.procedure_case_steps (tenant_id, case_id, state, ordinal);
CREATE INDEX procedure_case_documents_state_idx
  ON rag.procedure_case_documents (tenant_id, case_id, state);
CREATE INDEX procedure_case_blockers_open_idx
  ON rag.procedure_case_blockers (tenant_id, case_id, created_at DESC)
  WHERE resolved_at IS NULL;
CREATE INDEX procedure_case_events_case_idx
  ON rag.procedure_case_events (tenant_id, case_id, created_at, id);

CREATE FUNCTION rag.enforce_procedure_case_binding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, rag
AS $function$
DECLARE
  v_status TEXT;
  v_version INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT lifecycle_status, version_number
      INTO v_status, v_version
    FROM rag.procedure_versions
    WHERE tenant_id = NEW.tenant_id
      AND id = NEW.workflow_version_id;
    IF v_status IS DISTINCT FROM 'approved' THEN
      RAISE EXCEPTION 'procedure case requires an approved workflow version';
    END IF;
    IF NEW.workflow_version_number IS DISTINCT FROM v_version THEN
      RAISE EXCEPTION 'procedure case workflow version identity mismatch';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.initial_response_body IS NULL
     AND NEW.initial_response_status = 201
     AND NEW.initial_response_body IS NOT NULL
     AND NEW.initial_response_sha256 = public.digest(NEW.initial_response_body, 'sha256')
     AND NEW.initial_audit_id IS NOT NULL
     AND NEW.revision = OLD.revision
     AND NEW.tenant_id = OLD.tenant_id
     AND NEW.id = OLD.id
     AND NEW.case_key = OLD.case_key
     AND NEW.workflow_version_id = OLD.workflow_version_id
     AND NEW.workflow_version_number = OLD.workflow_version_number
     AND NEW.jurisdiction = OLD.jurisdiction
     AND NEW.subject_reference IS NOT DISTINCT FROM OLD.subject_reference
     AND NEW.community_reference IS NOT DISTINCT FROM OLD.community_reference
     AND NEW.status = OLD.status
     AND NEW.validation_state = OLD.validation_state
     AND NEW.current_step_id IS NOT DISTINCT FROM OLD.current_step_id
     AND NEW.follow_up_at IS NOT DISTINCT FROM OLD.follow_up_at
     AND NEW.operational_note IS NOT DISTINCT FROM OLD.operational_note
     AND NEW.created_by_principal_id = OLD.created_by_principal_id
     AND NEW.updated_by_principal_id = OLD.updated_by_principal_id
     AND NEW.create_request_sha256 = OLD.create_request_sha256
     AND NEW.created_at = OLD.created_at
     AND NEW.updated_at = OLD.updated_at THEN
    RETURN NEW;
  END IF;

  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.id IS DISTINCT FROM OLD.id
     OR NEW.case_key IS DISTINCT FROM OLD.case_key
     OR NEW.workflow_version_id IS DISTINCT FROM OLD.workflow_version_id
     OR NEW.workflow_version_number IS DISTINCT FROM OLD.workflow_version_number
     OR NEW.jurisdiction IS DISTINCT FROM OLD.jurisdiction
     OR NEW.subject_reference IS DISTINCT FROM OLD.subject_reference
     OR NEW.community_reference IS DISTINCT FROM OLD.community_reference
     OR NEW.created_by_principal_id IS DISTINCT FROM OLD.created_by_principal_id
     OR NEW.create_request_sha256 IS DISTINCT FROM OLD.create_request_sha256
     OR NEW.initial_response_status IS DISTINCT FROM OLD.initial_response_status
     OR NEW.initial_response_body IS DISTINCT FROM OLD.initial_response_body
     OR NEW.initial_response_sha256 IS DISTINCT FROM OLD.initial_response_sha256
     OR NEW.initial_audit_id IS DISTINCT FROM OLD.initial_audit_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'procedure case identity and workflow binding are immutable';
  END IF;
  IF NEW.revision <> OLD.revision + 1 THEN
    RAISE EXCEPTION 'procedure case revision must advance exactly once';
  END IF;
  IF OLD.status = 'closed' AND NEW.status <> 'closed' THEN
    RAISE EXCEPTION 'closed procedure cases cannot be reopened in v1';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER procedure_cases_binding_guard
BEFORE INSERT OR UPDATE ON rag.procedure_cases
FOR EACH ROW EXECUTE FUNCTION rag.enforce_procedure_case_binding();

CREATE FUNCTION rag.reject_procedure_case_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  RAISE EXCEPTION 'procedure case events are append-only';
END;
$function$;

CREATE TRIGGER procedure_case_events_append_only
BEFORE UPDATE OR DELETE ON rag.procedure_case_events
FOR EACH ROW EXECUTE FUNCTION rag.reject_procedure_case_event_mutation();

CREATE TABLE integration.procedure_case_idempotency (
  tenant_id UUID NOT NULL,
  principal_id UUID NOT NULL,
  operation TEXT NOT NULL,
  idempotency_key_sha256 BYTEA NOT NULL CHECK (octet_length(idempotency_key_sha256) = 32),
  request_sha256 BYTEA NOT NULL CHECK (octet_length(request_sha256) = 32),
  state TEXT NOT NULL CHECK (state IN ('processing', 'completed')),
  response_status INTEGER CHECK (response_status IN (200, 201)),
  response_body TEXT,
  response_sha256 BYTEA CHECK (response_sha256 IS NULL OR octet_length(response_sha256) = 32),
  audit_id UUID,
  created_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, principal_id, operation, idempotency_key_sha256),
  FOREIGN KEY (tenant_id) REFERENCES identity.tenants(id) ON DELETE RESTRICT,
  FOREIGN KEY (principal_id, tenant_id)
    REFERENCES identity.principals(id, tenant_id) ON DELETE RESTRICT,
  CHECK (
    (state = 'processing' AND response_status IS NULL AND response_body IS NULL AND response_sha256 IS NULL AND audit_id IS NULL AND completed_at IS NULL)
    OR
    (state = 'completed' AND response_status IS NOT NULL AND response_body IS NOT NULL AND octet_length(response_body) BETWEEN 2 AND 1048576 AND response_sha256 IS NOT NULL AND response_sha256 = public.digest(response_body, 'sha256') AND audit_id IS NOT NULL AND completed_at IS NOT NULL)
  )
);

CREATE TABLE integration.procedure_case_rate_limits (
  tenant_id UUID NOT NULL,
  principal_id UUID NOT NULL,
  operation TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count > 0),
  blocked_audit_id UUID,
  PRIMARY KEY (tenant_id, principal_id, operation, window_started_at),
  FOREIGN KEY (tenant_id) REFERENCES identity.tenants(id) ON DELETE RESTRICT,
  FOREIGN KEY (principal_id, tenant_id)
    REFERENCES identity.principals(id, tenant_id) ON DELETE RESTRICT
);

CREATE TABLE audit.procedure_case_authentication_failures (
  audit_id UUID PRIMARY KEY,
  reason_code TEXT NOT NULL CHECK (reason_code ~ '^[a-z][a-z0-9_]{0,63}$'),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp()
);
REVOKE ALL ON TABLE audit.procedure_case_authentication_failures FROM PUBLIC;

CREATE FUNCTION audit.record_procedure_case_authentication_failure(
  p_audit_id UUID,
  p_reason_code TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, audit
AS $function$
BEGIN
  INSERT INTO audit.procedure_case_authentication_failures (audit_id, reason_code)
  VALUES (p_audit_id, p_reason_code);
  DELETE FROM audit.procedure_case_authentication_failures
  WHERE occurred_at < statement_timestamp() - INTERVAL '30 days';
  RETURN p_audit_id;
END;
$function$;
REVOKE ALL ON FUNCTION audit.record_procedure_case_authentication_failure(UUID, TEXT) FROM PUBLIC;

ALTER TABLE rag.procedure_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag.procedure_cases FORCE ROW LEVEL SECURITY;
CREATE POLICY procedure_cases_tenant_isolation ON rag.procedure_cases
  FOR ALL USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

ALTER TABLE rag.procedure_case_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag.procedure_case_steps FORCE ROW LEVEL SECURITY;
CREATE POLICY procedure_case_steps_tenant_isolation ON rag.procedure_case_steps
  FOR ALL USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

ALTER TABLE rag.procedure_case_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag.procedure_case_documents FORCE ROW LEVEL SECURITY;
CREATE POLICY procedure_case_documents_tenant_isolation ON rag.procedure_case_documents
  FOR ALL USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

ALTER TABLE rag.procedure_case_blockers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag.procedure_case_blockers FORCE ROW LEVEL SECURITY;
CREATE POLICY procedure_case_blockers_tenant_isolation ON rag.procedure_case_blockers
  FOR ALL USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

ALTER TABLE rag.procedure_case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag.procedure_case_events FORCE ROW LEVEL SECURITY;
CREATE POLICY procedure_case_events_tenant_isolation ON rag.procedure_case_events
  FOR ALL USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

ALTER TABLE integration.procedure_case_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration.procedure_case_idempotency FORCE ROW LEVEL SECURITY;
CREATE POLICY procedure_case_idempotency_tenant_isolation
  ON integration.procedure_case_idempotency
  FOR ALL USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

ALTER TABLE integration.procedure_case_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration.procedure_case_rate_limits FORCE ROW LEVEL SECURITY;
CREATE POLICY procedure_case_rate_limits_tenant_isolation
  ON integration.procedure_case_rate_limits
  FOR ALL USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

REVOKE ALL ON TABLE
  rag.procedure_cases,
  rag.procedure_case_steps,
  rag.procedure_case_documents,
  rag.procedure_case_blockers,
  rag.procedure_case_events,
  integration.procedure_case_idempotency,
  integration.procedure_case_rate_limits
FROM PUBLIC;

COMMIT;
