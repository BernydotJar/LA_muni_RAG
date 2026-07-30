-- LA Muni RAG
-- WS-05 tenant-scoped procedure/workflow lifecycle with human review and approval.
-- AI-generated and imported workflow versions always enter as draft. Reviews and
-- approvals are append-only governance evidence; they never rewrite source evidence.

BEGIN;

CREATE TABLE rag.procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  procedure_key TEXT NOT NULL,
  title TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  created_by_principal_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  UNIQUE (id, tenant_id),
  UNIQUE (tenant_id, procedure_key),
  FOREIGN KEY (tenant_id)
    REFERENCES identity.tenants(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by_principal_id, tenant_id)
    REFERENCES identity.principals(id, tenant_id) ON DELETE RESTRICT,
  CHECK (procedure_key ~ '^[a-z0-9][a-z0-9._:-]{2,127}$'),
  CHECK (char_length(title) BETWEEN 1 AND 300 AND title !~ '[[:cntrl:]]'),
  CHECK (char_length(jurisdiction) BETWEEN 1 AND 500 AND jurisdiction !~ '[[:cntrl:]]')
);

CREATE TABLE rag.procedure_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  procedure_id UUID NOT NULL,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  lifecycle_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (lifecycle_status IN ('draft', 'in_review', 'approved', 'superseded', 'archived')),
  generation_source TEXT NOT NULL
    CHECK (generation_source IN ('ai', 'human', 'import')),
  created_by_principal_id UUID NOT NULL,
  title TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  workflow_definition JSONB NOT NULL,
  evidence_bundle_id UUID,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  submitted_by_principal_id UUID,
  submitted_at TIMESTAMPTZ,
  approved_by_principal_id UUID,
  approved_at TIMESTAMPTZ,
  superseded_by_workflow_version_id UUID,
  archived_by_principal_id UUID,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  UNIQUE (id, tenant_id),
  UNIQUE (tenant_id, procedure_id, version_number),
  FOREIGN KEY (tenant_id)
    REFERENCES identity.tenants(id) ON DELETE RESTRICT,
  FOREIGN KEY (procedure_id, tenant_id)
    REFERENCES rag.procedures(id, tenant_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_principal_id, tenant_id)
    REFERENCES identity.principals(id, tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (submitted_by_principal_id, tenant_id)
    REFERENCES identity.principals(id, tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (approved_by_principal_id, tenant_id)
    REFERENCES identity.principals(id, tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (archived_by_principal_id, tenant_id)
    REFERENCES identity.principals(id, tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (superseded_by_workflow_version_id, tenant_id)
    REFERENCES rag.procedure_versions(id, tenant_id) ON DELETE RESTRICT,
  CHECK (char_length(title) BETWEEN 1 AND 300 AND title !~ '[[:cntrl:]]'),
  CHECK (char_length(jurisdiction) BETWEEN 1 AND 500 AND jurisdiction !~ '[[:cntrl:]]'),
  CHECK (jsonb_typeof(workflow_definition) = 'object'),
  CHECK (octet_length(workflow_definition::text) BETWEEN 2 AND 2097152),
  CHECK (
    (submitted_by_principal_id IS NULL AND submitted_at IS NULL)
    OR
    (submitted_by_principal_id IS NOT NULL AND submitted_at IS NOT NULL)
  ),
  CHECK (
    (approved_by_principal_id IS NULL AND approved_at IS NULL)
    OR
    (approved_by_principal_id IS NOT NULL AND approved_at IS NOT NULL)
  ),
  CHECK (
    (archived_by_principal_id IS NULL AND archived_at IS NULL)
    OR
    (archived_by_principal_id IS NOT NULL AND archived_at IS NOT NULL)
  ),
  CHECK (superseded_by_workflow_version_id IS NULL OR superseded_by_workflow_version_id <> id),
  CHECK (lifecycle_status <> 'in_review' OR submitted_at IS NOT NULL),
  CHECK (lifecycle_status NOT IN ('approved', 'superseded') OR approved_at IS NOT NULL),
  CHECK (lifecycle_status <> 'superseded' OR superseded_by_workflow_version_id IS NOT NULL),
  CHECK (lifecycle_status <> 'archived' OR archived_at IS NOT NULL)
);

CREATE UNIQUE INDEX procedure_versions_one_approved_idx
  ON rag.procedure_versions (tenant_id, procedure_id)
  WHERE lifecycle_status = 'approved';
CREATE INDEX procedure_versions_lifecycle_idx
  ON rag.procedure_versions (tenant_id, lifecycle_status, updated_at DESC);
CREATE INDEX procedure_versions_procedure_idx
  ON rag.procedure_versions (tenant_id, procedure_id, version_number DESC);

CREATE TABLE rag.workflow_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  workflow_version_id UUID NOT NULL,
  reviewer_principal_id UUID NOT NULL,
  decision TEXT NOT NULL
    CHECK (decision IN ('changes_requested', 'recommended_for_approval')),
  notes TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  UNIQUE (id, tenant_id),
  FOREIGN KEY (tenant_id)
    REFERENCES identity.tenants(id) ON DELETE RESTRICT,
  FOREIGN KEY (workflow_version_id, tenant_id)
    REFERENCES rag.procedure_versions(id, tenant_id) ON DELETE CASCADE,
  FOREIGN KEY (reviewer_principal_id, tenant_id)
    REFERENCES identity.principals(id, tenant_id) ON DELETE RESTRICT,
  CHECK (char_length(notes) BETWEEN 1 AND 4000 AND notes !~ '[[:cntrl:]]')
);

CREATE INDEX workflow_reviews_version_idx
  ON rag.workflow_reviews (tenant_id, workflow_version_id, created_at DESC);

CREATE TABLE rag.workflow_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  workflow_version_id UUID NOT NULL,
  approver_principal_id UUID NOT NULL,
  decision TEXT NOT NULL DEFAULT 'approved' CHECK (decision = 'approved'),
  notes TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  UNIQUE (id, tenant_id),
  UNIQUE (tenant_id, workflow_version_id),
  FOREIGN KEY (tenant_id)
    REFERENCES identity.tenants(id) ON DELETE RESTRICT,
  FOREIGN KEY (workflow_version_id, tenant_id)
    REFERENCES rag.procedure_versions(id, tenant_id) ON DELETE CASCADE,
  FOREIGN KEY (approver_principal_id, tenant_id)
    REFERENCES identity.principals(id, tenant_id) ON DELETE RESTRICT,
  CHECK (char_length(notes) BETWEEN 1 AND 4000 AND notes !~ '[[:cntrl:]]')
);

CREATE FUNCTION rag.enforce_workflow_version_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, rag
AS $function$
DECLARE
  v_reviewer UUID;
  v_review_decision TEXT;
  v_replacement_procedure UUID;
  v_replacement_status TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.lifecycle_status <> 'draft' THEN
      RAISE EXCEPTION 'new workflow versions must start as draft';
    END IF;
    IF NEW.submitted_at IS NOT NULL OR NEW.approved_at IS NOT NULL
       OR NEW.superseded_by_workflow_version_id IS NOT NULL OR NEW.archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'new workflow drafts cannot include lifecycle decisions';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.procedure_id IS DISTINCT FROM OLD.procedure_id
     OR NEW.version_number IS DISTINCT FROM OLD.version_number
     OR NEW.generation_source IS DISTINCT FROM OLD.generation_source
     OR NEW.created_by_principal_id IS DISTINCT FROM OLD.created_by_principal_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'workflow version identity is immutable';
  END IF;

  IF OLD.lifecycle_status IN ('approved', 'superseded', 'archived') AND (
    NEW.title IS DISTINCT FROM OLD.title
    OR NEW.jurisdiction IS DISTINCT FROM OLD.jurisdiction
    OR NEW.workflow_definition IS DISTINCT FROM OLD.workflow_definition
    OR NEW.evidence_bundle_id IS DISTINCT FROM OLD.evidence_bundle_id
    OR NEW.revision IS DISTINCT FROM OLD.revision
  ) THEN
    RAISE EXCEPTION 'approved, superseded, and archived workflow content is immutable';
  END IF;

  IF OLD.lifecycle_status = 'archived' AND NEW.lifecycle_status <> 'archived' THEN
    RAISE EXCEPTION 'archived workflow versions are terminal';
  END IF;

  IF OLD.lifecycle_status = 'draft' AND NEW.lifecycle_status NOT IN ('draft', 'in_review', 'archived') THEN
    RAISE EXCEPTION 'invalid draft workflow transition';
  ELSIF OLD.lifecycle_status = 'in_review'
     AND NEW.lifecycle_status NOT IN ('in_review', 'draft', 'approved', 'archived') THEN
    RAISE EXCEPTION 'invalid review workflow transition';
  ELSIF OLD.lifecycle_status = 'approved'
     AND NEW.lifecycle_status NOT IN ('approved', 'superseded', 'archived') THEN
    RAISE EXCEPTION 'invalid approved workflow transition';
  ELSIF OLD.lifecycle_status = 'superseded'
     AND NEW.lifecycle_status NOT IN ('superseded', 'archived') THEN
    RAISE EXCEPTION 'invalid superseded workflow transition';
  END IF;

  IF NEW.lifecycle_status = 'in_review' AND (
    NEW.submitted_by_principal_id IS NULL OR NEW.submitted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'review submission requires a human principal and timestamp';
  END IF;

  IF NEW.lifecycle_status = 'approved' AND OLD.lifecycle_status <> 'approved' THEN
    SELECT reviewer_principal_id, decision
    INTO v_reviewer, v_review_decision
    FROM rag.workflow_reviews
    WHERE tenant_id = NEW.tenant_id
      AND workflow_version_id = NEW.id
    ORDER BY created_at DESC, id DESC
    LIMIT 1;

    IF v_reviewer IS NULL OR v_review_decision <> 'recommended_for_approval' THEN
      RAISE EXCEPTION 'approval requires a recommended human review';
    END IF;
    IF NEW.approved_by_principal_id IS NULL OR NEW.approved_at IS NULL THEN
      RAISE EXCEPTION 'approval requires an approver and timestamp';
    END IF;
    IF NEW.approved_by_principal_id IN (NEW.created_by_principal_id, v_reviewer)
       OR v_reviewer = NEW.created_by_principal_id THEN
      RAISE EXCEPTION 'creator, reviewer, and approver must be distinct';
    END IF;
  END IF;

  IF NEW.lifecycle_status = 'superseded' AND OLD.lifecycle_status <> 'superseded' THEN
    IF NEW.superseded_by_workflow_version_id IS NULL THEN
      RAISE EXCEPTION 'supersession requires a replacement workflow version';
    END IF;
    SELECT procedure_id, lifecycle_status
    INTO v_replacement_procedure, v_replacement_status
    FROM rag.procedure_versions
    WHERE tenant_id = NEW.tenant_id
      AND id = NEW.superseded_by_workflow_version_id
    FOR UPDATE;
    IF v_replacement_procedure IS DISTINCT FROM NEW.procedure_id
       OR v_replacement_status IS DISTINCT FROM 'in_review' THEN
      RAISE EXCEPTION 'replacement workflow must be an in_review version of the same procedure';
    END IF;
  END IF;

  IF NEW.lifecycle_status = 'archived' AND (
    NEW.archived_by_principal_id IS NULL OR NEW.archived_at IS NULL
  ) THEN
    RAISE EXCEPTION 'archival requires a human principal and timestamp';
  END IF;

  NEW.updated_at := statement_timestamp();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER procedure_versions_lifecycle_guard
BEFORE INSERT OR UPDATE ON rag.procedure_versions
FOR EACH ROW EXECUTE FUNCTION rag.enforce_workflow_version_lifecycle();

CREATE FUNCTION rag.prevent_workflow_governance_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, rag
AS $function$
BEGIN
  RAISE EXCEPTION 'workflow review and approval evidence is append-only';
END;
$function$;

CREATE TRIGGER workflow_reviews_append_only
BEFORE UPDATE OR DELETE ON rag.workflow_reviews
FOR EACH ROW EXECUTE FUNCTION rag.prevent_workflow_governance_mutation();

CREATE TRIGGER workflow_approvals_append_only
BEFORE UPDATE OR DELETE ON rag.workflow_approvals
FOR EACH ROW EXECUTE FUNCTION rag.prevent_workflow_governance_mutation();

CREATE FUNCTION rag.validate_workflow_review_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, rag
AS $function$
DECLARE
  v_status TEXT;
  v_creator UUID;
BEGIN
  SELECT lifecycle_status, created_by_principal_id
  INTO v_status, v_creator
  FROM rag.procedure_versions
  WHERE tenant_id = NEW.tenant_id
    AND id = NEW.workflow_version_id
  FOR UPDATE;

  IF v_status IS DISTINCT FROM 'in_review' THEN
    RAISE EXCEPTION 'workflow review requires in_review status';
  END IF;
  IF NEW.reviewer_principal_id = v_creator THEN
    RAISE EXCEPTION 'workflow creator cannot review the same version';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER workflow_reviews_insert_guard
BEFORE INSERT ON rag.workflow_reviews
FOR EACH ROW EXECUTE FUNCTION rag.validate_workflow_review_insert();

CREATE FUNCTION rag.validate_workflow_approval_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, rag
AS $function$
DECLARE
  v_status TEXT;
  v_creator UUID;
  v_reviewer UUID;
  v_review_decision TEXT;
BEGIN
  SELECT lifecycle_status, created_by_principal_id
  INTO v_status, v_creator
  FROM rag.procedure_versions
  WHERE tenant_id = NEW.tenant_id
    AND id = NEW.workflow_version_id
  FOR UPDATE;

  SELECT reviewer_principal_id, decision
  INTO v_reviewer, v_review_decision
  FROM rag.workflow_reviews
  WHERE tenant_id = NEW.tenant_id
    AND workflow_version_id = NEW.workflow_version_id
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  IF v_status IS DISTINCT FROM 'in_review'
     OR v_review_decision IS DISTINCT FROM 'recommended_for_approval' THEN
    RAISE EXCEPTION 'workflow approval requires a recommended in_review version';
  END IF;
  IF NEW.approver_principal_id IN (v_creator, v_reviewer) OR v_creator = v_reviewer THEN
    RAISE EXCEPTION 'creator, reviewer, and approver must be distinct';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER workflow_approvals_insert_guard
BEFORE INSERT ON rag.workflow_approvals
FOR EACH ROW EXECUTE FUNCTION rag.validate_workflow_approval_insert();

ALTER TABLE rag.procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag.procedures FORCE ROW LEVEL SECURITY;
CREATE POLICY procedures_tenant_isolation ON rag.procedures
  FOR ALL
  USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

ALTER TABLE rag.procedure_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag.procedure_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY procedure_versions_tenant_isolation ON rag.procedure_versions
  FOR ALL
  USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

ALTER TABLE rag.workflow_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag.workflow_reviews FORCE ROW LEVEL SECURITY;
CREATE POLICY workflow_reviews_tenant_isolation ON rag.workflow_reviews
  FOR ALL
  USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

ALTER TABLE rag.workflow_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag.workflow_approvals FORCE ROW LEVEL SECURITY;
CREATE POLICY workflow_approvals_tenant_isolation ON rag.workflow_approvals
  FOR ALL
  USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

REVOKE ALL ON TABLE
  rag.procedures,
  rag.procedure_versions,
  rag.workflow_reviews,
  rag.workflow_approvals
FROM PUBLIC;

COMMENT ON TABLE rag.procedure_versions IS
  'Tenant-owned immutable workflow versions governed by draft/in_review/approved/superseded/archived lifecycle.';
COMMENT ON TABLE rag.workflow_reviews IS
  'Append-only human review evidence; feedback never becomes authoritative procedure automatically.';
COMMENT ON TABLE rag.workflow_approvals IS
  'Append-only human approval evidence with creator/reviewer/approver separation of duties.';

COMMIT;
