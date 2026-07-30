-- LA Muni RAG
-- WS-07 identity, tenancy, RBAC, and row-level isolation foundation.
--
-- This migration intentionally creates no PostgreSQL login/managed role.
-- Operators must grant the existing non-owner application role only the
-- privileges documented in docs/security/tenancy.md.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA identity;

CREATE TYPE identity.role_name AS ENUM (
  'platform_admin',
  'tenant_admin',
  'document_manager',
  'researcher',
  'procedure_author',
  'procedure_reviewer',
  'procedure_approver',
  'case_operator',
  'viewer',
  'integration_client'
);

CREATE TABLE identity.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 200),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE identity.principals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE RESTRICT,
  principal_kind TEXT NOT NULL CHECK (principal_kind IN ('user', 'service', 'integration')),
  external_subject TEXT,
  display_name TEXT NOT NULL CHECK (char_length(trim(display_name)) BETWEEN 1 AND 200),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, tenant_id),
  UNIQUE (tenant_id, external_subject)
);

CREATE TABLE identity.memberships (
  tenant_id UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
  principal_id UUID NOT NULL,
  role identity.role_name NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, principal_id, role),
  FOREIGN KEY (principal_id, tenant_id)
    REFERENCES identity.principals(id, tenant_id) ON DELETE CASCADE
);

CREATE TABLE identity.api_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE CASCADE,
  principal_id UUID NOT NULL,
  label TEXT NOT NULL CHECK (char_length(trim(label)) BETWEEN 1 AND 120),
  secret_sha256 BYTEA NOT NULL UNIQUE CHECK (octet_length(secret_sha256) = 32),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  UNIQUE (id, tenant_id),
  FOREIGN KEY (principal_id, tenant_id)
    REFERENCES identity.principals(id, tenant_id) ON DELETE CASCADE,
  CHECK (expires_at IS NULL OR expires_at > created_at),
  CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

CREATE INDEX principals_tenant_status_idx
  ON identity.principals (tenant_id, status);
CREATE INDEX memberships_principal_tenant_idx
  ON identity.memberships (principal_id, tenant_id);
CREATE INDEX api_credentials_tenant_principal_idx
  ON identity.api_credentials (tenant_id, principal_id)
  WHERE revoked_at IS NULL;

-- Stable bootstrap owner for every record that predates tenant support. This is
-- an explicit migration bridge, never a runtime default for new rows.
INSERT INTO identity.tenants (id, slug, name, status, metadata)
VALUES (
  '00000000-0000-4000-8000-000000000001'::uuid,
  'legacy-bootstrap',
  'Legacy bootstrap tenant',
  'active',
  '{"bootstrap":true,"requires_reassignment_review":true}'::jsonb
);

-- current_setting(..., true) returns NULL when the application has not set a
-- transaction-local tenant. Returning NULL makes every tenant policy deny.
CREATE FUNCTION identity.current_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, identity
AS $function$
DECLARE
  tenant_setting TEXT;
BEGIN
  tenant_setting := current_setting('app.tenant_id', true);
  IF tenant_setting IS NULL OR tenant_setting !~
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  THEN
    RETURN NULL;
  END IF;
  RETURN tenant_setting::uuid;
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN NULL;
END;
$function$;

-- Authentication is the sole pre-tenant lookup. The function accepts exactly
-- a 32-byte SHA-256 digest, has a fixed search_path, and returns no secret data.
CREATE FUNCTION identity.authenticate_api_credential(p_secret_sha256 BYTEA)
RETURNS TABLE (
  credential_id UUID,
  tenant_id UUID,
  principal_id UUID,
  roles TEXT[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, identity
AS $function$
  SELECT
    credential.id AS credential_id,
    credential.tenant_id,
    principal.id AS principal_id,
    array_agg(membership.role::text ORDER BY membership.role::text) AS roles
  FROM identity.api_credentials AS credential
  JOIN identity.principals AS principal
    ON principal.id = credential.principal_id
   AND principal.tenant_id = credential.tenant_id
  JOIN identity.tenants AS tenant
    ON tenant.id = credential.tenant_id
  JOIN identity.memberships AS membership
    ON membership.principal_id = principal.id
   AND membership.tenant_id = principal.tenant_id
  WHERE octet_length(p_secret_sha256) = 32
    AND credential.secret_sha256 = p_secret_sha256
    AND credential.revoked_at IS NULL
    AND (credential.expires_at IS NULL OR credential.expires_at > statement_timestamp())
    AND principal.status = 'active'
    AND tenant.status = 'active'
  GROUP BY credential.id, credential.tenant_id, principal.id
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION identity.authenticate_api_credential(BYTEA) FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA identity FROM PUBLIC;

-- Identity tables are tenant-filtered for normal application access. They are
-- not FORCEd because the narrowly-scoped SECURITY DEFINER authentication
-- function must perform the pre-tenant digest lookup as the migration owner.
ALTER TABLE identity.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.principals ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.api_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenants_tenant_isolation ON identity.tenants
  FOR ALL
  USING (id = identity.current_tenant_id())
  WITH CHECK (id = identity.current_tenant_id());
CREATE POLICY principals_tenant_isolation ON identity.principals
  FOR ALL
  USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());
CREATE POLICY memberships_tenant_isolation ON identity.memberships
  FOR ALL
  USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());
CREATE POLICY api_credentials_tenant_isolation ON identity.api_credentials
  FOR ALL
  USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

-- ---------------------------------------------------------------------------
-- Explicit legacy backfill and top-level tenant ownership
-- ---------------------------------------------------------------------------

ALTER TABLE rag.municipalities ADD COLUMN tenant_id UUID;
UPDATE rag.municipalities
SET tenant_id = '00000000-0000-4000-8000-000000000001'::uuid
WHERE tenant_id IS NULL;
ALTER TABLE rag.municipalities ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE rag.municipalities
  ADD CONSTRAINT municipalities_tenant_fk
  FOREIGN KEY (tenant_id) REFERENCES identity.tenants(id) ON DELETE RESTRICT;
ALTER TABLE rag.municipalities
  ADD CONSTRAINT municipalities_id_tenant_key UNIQUE (id, tenant_id);
-- Human-readable slugs must not create a cross-tenant uniqueness oracle.
ALTER TABLE rag.municipalities DROP CONSTRAINT municipalities_slug_key;
ALTER TABLE rag.municipalities
  ADD CONSTRAINT municipalities_tenant_slug_key UNIQUE (tenant_id, slug);

ALTER TABLE rag.documents ADD COLUMN tenant_id UUID;
UPDATE rag.documents
SET tenant_id = '00000000-0000-4000-8000-000000000001'::uuid
WHERE tenant_id IS NULL;
ALTER TABLE rag.documents ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE rag.documents
  ADD CONSTRAINT documents_tenant_fk
  FOREIGN KEY (tenant_id) REFERENCES identity.tenants(id) ON DELETE RESTRICT;
ALTER TABLE rag.documents
  ADD CONSTRAINT documents_id_tenant_key UNIQUE (id, tenant_id);
ALTER TABLE rag.documents
  ADD CONSTRAINT documents_municipality_tenant_fk
  FOREIGN KEY (municipality_id, tenant_id)
  REFERENCES rag.municipalities(id, tenant_id) ON DELETE RESTRICT;

ALTER TABLE rag.document_versions ADD COLUMN tenant_id UUID;
UPDATE rag.document_versions AS version
SET tenant_id = document.tenant_id
FROM rag.documents AS document
WHERE version.document_id = document.id
  AND version.tenant_id IS NULL;
ALTER TABLE rag.document_versions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE rag.document_versions
  ADD CONSTRAINT document_versions_tenant_fk
  FOREIGN KEY (tenant_id) REFERENCES identity.tenants(id) ON DELETE RESTRICT;
ALTER TABLE rag.document_versions
  ADD CONSTRAINT document_versions_id_tenant_key UNIQUE (id, tenant_id);
-- Version labels and content hashes are tenant-owned identities. Keeping their
-- legacy global constraints would both reject legitimate shared public bytes
-- and disclose cross-tenant existence through unique-violation behavior.
ALTER TABLE rag.document_versions
  DROP CONSTRAINT document_versions_document_id_version_label_key;
ALTER TABLE rag.document_versions
  DROP CONSTRAINT document_versions_content_sha256_key;
ALTER TABLE rag.document_versions
  ADD CONSTRAINT document_versions_tenant_document_version_key
  UNIQUE (tenant_id, document_id, version_label);
ALTER TABLE rag.document_versions
  ADD CONSTRAINT document_versions_tenant_content_sha256_key
  UNIQUE (tenant_id, content_sha256);
ALTER TABLE rag.document_versions
  ADD CONSTRAINT document_versions_document_tenant_fk
  FOREIGN KEY (document_id, tenant_id)
  REFERENCES rag.documents(id, tenant_id) ON DELETE CASCADE;

ALTER TABLE rag.document_sections ADD COLUMN tenant_id UUID;
UPDATE rag.document_sections AS section
SET tenant_id = version.tenant_id
FROM rag.document_versions AS version
WHERE section.document_version_id = version.id
  AND section.tenant_id IS NULL;
ALTER TABLE rag.document_sections ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE rag.document_sections
  ADD CONSTRAINT document_sections_tenant_fk
  FOREIGN KEY (tenant_id) REFERENCES identity.tenants(id) ON DELETE RESTRICT;
ALTER TABLE rag.document_sections
  ADD CONSTRAINT document_sections_id_tenant_key UNIQUE (id, tenant_id);
ALTER TABLE rag.document_sections
  ADD CONSTRAINT document_sections_version_tenant_fk
  FOREIGN KEY (document_version_id, tenant_id)
  REFERENCES rag.document_versions(id, tenant_id) ON DELETE CASCADE;
ALTER TABLE rag.document_sections
  ADD CONSTRAINT document_sections_parent_tenant_fk
  FOREIGN KEY (parent_section_id, tenant_id)
  REFERENCES rag.document_sections(id, tenant_id) ON DELETE CASCADE;

ALTER TABLE rag.section_embeddings ADD COLUMN tenant_id UUID;
UPDATE rag.section_embeddings AS embedding
SET tenant_id = section.tenant_id
FROM rag.document_sections AS section
WHERE embedding.section_id = section.id
  AND embedding.tenant_id IS NULL;
ALTER TABLE rag.section_embeddings ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE rag.section_embeddings
  ADD CONSTRAINT section_embeddings_tenant_fk
  FOREIGN KEY (tenant_id) REFERENCES identity.tenants(id) ON DELETE RESTRICT;
ALTER TABLE rag.section_embeddings
  ADD CONSTRAINT section_embeddings_id_tenant_key UNIQUE (id, tenant_id);
ALTER TABLE rag.section_embeddings
  ADD CONSTRAINT section_embeddings_section_tenant_fk
  FOREIGN KEY (section_id, tenant_id)
  REFERENCES rag.document_sections(id, tenant_id) ON DELETE CASCADE;

ALTER TABLE rag.ingestion_jobs ADD COLUMN tenant_id UUID;
UPDATE rag.ingestion_jobs AS job
SET tenant_id = version.tenant_id
FROM rag.document_versions AS version
WHERE job.document_version_id = version.id
  AND job.tenant_id IS NULL;
UPDATE rag.ingestion_jobs
SET tenant_id = '00000000-0000-4000-8000-000000000001'::uuid
WHERE tenant_id IS NULL;
ALTER TABLE rag.ingestion_jobs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE rag.ingestion_jobs
  ADD CONSTRAINT ingestion_jobs_tenant_fk
  FOREIGN KEY (tenant_id) REFERENCES identity.tenants(id) ON DELETE RESTRICT;
ALTER TABLE rag.ingestion_jobs
  ADD CONSTRAINT ingestion_jobs_id_tenant_key UNIQUE (id, tenant_id);
ALTER TABLE rag.ingestion_jobs
  ADD CONSTRAINT ingestion_jobs_version_tenant_fk
  FOREIGN KEY (document_version_id, tenant_id)
  REFERENCES rag.document_versions(id, tenant_id) ON DELETE CASCADE;

ALTER TABLE agent.conversations ADD COLUMN tenant_id UUID;
UPDATE agent.conversations
SET tenant_id = '00000000-0000-4000-8000-000000000001'::uuid
WHERE tenant_id IS NULL;
ALTER TABLE agent.conversations ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE agent.conversations
  ADD CONSTRAINT conversations_tenant_fk
  FOREIGN KEY (tenant_id) REFERENCES identity.tenants(id) ON DELETE RESTRICT;
ALTER TABLE agent.conversations
  ADD CONSTRAINT conversations_id_tenant_key UNIQUE (id, tenant_id);
ALTER TABLE agent.conversations
  ADD CONSTRAINT conversations_municipality_tenant_fk
  FOREIGN KEY (municipality_id, tenant_id)
  REFERENCES rag.municipalities(id, tenant_id) ON DELETE RESTRICT;

ALTER TABLE agent.messages ADD COLUMN tenant_id UUID;
UPDATE agent.messages AS message
SET tenant_id = conversation.tenant_id
FROM agent.conversations AS conversation
WHERE message.conversation_id = conversation.id
  AND message.tenant_id IS NULL;
ALTER TABLE agent.messages ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE agent.messages
  ADD CONSTRAINT messages_tenant_fk
  FOREIGN KEY (tenant_id) REFERENCES identity.tenants(id) ON DELETE RESTRICT;
ALTER TABLE agent.messages
  ADD CONSTRAINT messages_id_tenant_key UNIQUE (id, tenant_id);
ALTER TABLE agent.messages
  ADD CONSTRAINT messages_conversation_tenant_fk
  FOREIGN KEY (conversation_id, tenant_id)
  REFERENCES agent.conversations(id, tenant_id) ON DELETE CASCADE;

ALTER TABLE agent.runs ADD COLUMN tenant_id UUID;
UPDATE agent.runs AS run
SET tenant_id = conversation.tenant_id
FROM agent.conversations AS conversation
WHERE run.conversation_id = conversation.id
  AND run.tenant_id IS NULL;
UPDATE agent.runs
SET tenant_id = '00000000-0000-4000-8000-000000000001'::uuid
WHERE tenant_id IS NULL;
ALTER TABLE agent.runs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE agent.runs
  ADD CONSTRAINT runs_tenant_fk
  FOREIGN KEY (tenant_id) REFERENCES identity.tenants(id) ON DELETE RESTRICT;
ALTER TABLE agent.runs
  ADD CONSTRAINT runs_id_tenant_key UNIQUE (id, tenant_id);
ALTER TABLE agent.runs
  ADD CONSTRAINT runs_conversation_tenant_fk
  FOREIGN KEY (conversation_id, tenant_id)
  REFERENCES agent.conversations(id, tenant_id) ON DELETE SET NULL (conversation_id);
ALTER TABLE agent.runs
  ADD CONSTRAINT runs_user_message_tenant_fk
  FOREIGN KEY (user_message_id, tenant_id)
  REFERENCES agent.messages(id, tenant_id) ON DELETE SET NULL (user_message_id);
ALTER TABLE agent.runs
  ADD CONSTRAINT runs_assistant_message_tenant_fk
  FOREIGN KEY (assistant_message_id, tenant_id)
  REFERENCES agent.messages(id, tenant_id) ON DELETE SET NULL (assistant_message_id);

ALTER TABLE agent.retrieval_events ADD COLUMN tenant_id UUID;
UPDATE agent.retrieval_events AS event
SET tenant_id = run.tenant_id
FROM agent.runs AS run
WHERE event.run_id = run.id
  AND event.tenant_id IS NULL;
ALTER TABLE agent.retrieval_events ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE agent.retrieval_events
  ADD CONSTRAINT retrieval_events_tenant_fk
  FOREIGN KEY (tenant_id) REFERENCES identity.tenants(id) ON DELETE RESTRICT;
ALTER TABLE agent.retrieval_events
  ADD CONSTRAINT retrieval_events_id_tenant_key UNIQUE (id, tenant_id);
ALTER TABLE agent.retrieval_events
  ADD CONSTRAINT retrieval_events_run_tenant_fk
  FOREIGN KEY (run_id, tenant_id)
  REFERENCES agent.runs(id, tenant_id) ON DELETE CASCADE;

ALTER TABLE agent.retrieval_results ADD COLUMN tenant_id UUID;
UPDATE agent.retrieval_results AS result
SET tenant_id = event.tenant_id
FROM agent.retrieval_events AS event
WHERE result.retrieval_event_id = event.id
  AND result.tenant_id IS NULL;
ALTER TABLE agent.retrieval_results ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE agent.retrieval_results
  ADD CONSTRAINT retrieval_results_tenant_fk
  FOREIGN KEY (tenant_id) REFERENCES identity.tenants(id) ON DELETE RESTRICT;
ALTER TABLE agent.retrieval_results
  ADD CONSTRAINT retrieval_results_id_tenant_key UNIQUE (id, tenant_id);
ALTER TABLE agent.retrieval_results
  ADD CONSTRAINT retrieval_results_event_tenant_fk
  FOREIGN KEY (retrieval_event_id, tenant_id)
  REFERENCES agent.retrieval_events(id, tenant_id) ON DELETE CASCADE;
ALTER TABLE agent.retrieval_results
  ADD CONSTRAINT retrieval_results_section_tenant_fk
  FOREIGN KEY (section_id, tenant_id)
  REFERENCES rag.document_sections(id, tenant_id) ON DELETE RESTRICT;

ALTER TABLE agent.answer_citations ADD COLUMN tenant_id UUID;
UPDATE agent.answer_citations AS citation
SET tenant_id = run.tenant_id
FROM agent.runs AS run
WHERE citation.run_id = run.id
  AND citation.tenant_id IS NULL;
ALTER TABLE agent.answer_citations ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE agent.answer_citations
  ADD CONSTRAINT answer_citations_tenant_fk
  FOREIGN KEY (tenant_id) REFERENCES identity.tenants(id) ON DELETE RESTRICT;
ALTER TABLE agent.answer_citations
  ADD CONSTRAINT answer_citations_id_tenant_key UNIQUE (id, tenant_id);
ALTER TABLE agent.answer_citations
  ADD CONSTRAINT answer_citations_run_tenant_fk
  FOREIGN KEY (run_id, tenant_id)
  REFERENCES agent.runs(id, tenant_id) ON DELETE CASCADE;
ALTER TABLE agent.answer_citations
  ADD CONSTRAINT answer_citations_section_tenant_fk
  FOREIGN KEY (section_id, tenant_id)
  REFERENCES rag.document_sections(id, tenant_id) ON DELETE RESTRICT;

ALTER TABLE agent.procedure_feedback ADD COLUMN tenant_id UUID;
UPDATE agent.procedure_feedback
SET tenant_id = '00000000-0000-4000-8000-000000000001'::uuid
WHERE tenant_id IS NULL;
ALTER TABLE agent.procedure_feedback ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE agent.procedure_feedback
  ADD CONSTRAINT procedure_feedback_tenant_fk
  FOREIGN KEY (tenant_id) REFERENCES identity.tenants(id) ON DELETE RESTRICT;
ALTER TABLE agent.procedure_feedback
  ADD CONSTRAINT procedure_feedback_id_tenant_key UNIQUE (id, tenant_id);

ALTER TABLE audit.events ADD COLUMN tenant_id UUID;
UPDATE audit.events
SET tenant_id = '00000000-0000-4000-8000-000000000001'::uuid
WHERE tenant_id IS NULL;
ALTER TABLE audit.events ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE audit.events
  ADD CONSTRAINT audit_events_tenant_fk
  FOREIGN KEY (tenant_id) REFERENCES identity.tenants(id) ON DELETE RESTRICT;
ALTER TABLE audit.events
  ADD CONSTRAINT audit_events_event_type_safe_chk CHECK (
    char_length(event_type) BETWEEN 1 AND 120 AND event_type !~ '[[:cntrl:]]'
  );

CREATE INDEX municipalities_tenant_idx ON rag.municipalities (tenant_id, id);
CREATE INDEX documents_tenant_status_idx ON rag.documents (tenant_id, status, document_type);
CREATE INDEX document_versions_tenant_idx ON rag.document_versions (tenant_id, document_id);
CREATE INDEX document_sections_tenant_idx ON rag.document_sections (tenant_id, document_version_id);
CREATE INDEX section_embeddings_tenant_idx ON rag.section_embeddings (tenant_id, section_id);
CREATE INDEX ingestion_jobs_tenant_status_idx ON rag.ingestion_jobs (tenant_id, status, job_type);
CREATE INDEX conversations_tenant_idx ON agent.conversations (tenant_id, created_at);
CREATE INDEX messages_tenant_idx ON agent.messages (tenant_id, conversation_id, created_at);
CREATE INDEX runs_tenant_idx ON agent.runs (tenant_id, created_at);
CREATE INDEX retrieval_events_tenant_idx ON agent.retrieval_events (tenant_id, created_at);
CREATE INDEX retrieval_results_tenant_idx ON agent.retrieval_results (tenant_id, retrieval_event_id, rank);
CREATE INDEX answer_citations_tenant_idx ON agent.answer_citations (tenant_id, run_id, citation_order);
CREATE INDEX procedure_feedback_tenant_idx ON agent.procedure_feedback (tenant_id, created_at DESC);
CREATE INDEX audit_events_tenant_idx ON audit.events (tenant_id, created_at DESC);

-- The vector store lives in a legacy standalone migration. Harden it when it
-- already exists; deployments using it must apply that migration before 003.
DO $migration$
BEGIN
  IF to_regclass('rag.embedding_vectors') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE rag.embedding_vectors ADD COLUMN tenant_id UUID';
    EXECUTE 'UPDATE rag.embedding_vectors SET tenant_id = ''00000000-0000-4000-8000-000000000001''::uuid WHERE tenant_id IS NULL';
    EXECUTE 'ALTER TABLE rag.embedding_vectors ALTER COLUMN tenant_id SET NOT NULL';
    EXECUTE 'ALTER TABLE rag.embedding_vectors ADD CONSTRAINT embedding_vectors_tenant_fk FOREIGN KEY (tenant_id) REFERENCES identity.tenants(id) ON DELETE RESTRICT';
    EXECUTE 'ALTER TABLE rag.embedding_vectors DROP CONSTRAINT embedding_vectors_pkey';
    EXECUTE 'ALTER TABLE rag.embedding_vectors ADD CONSTRAINT embedding_vectors_pkey PRIMARY KEY (tenant_id, chunk_id)';
    EXECUTE 'CREATE INDEX embedding_vectors_tenant_idx ON rag.embedding_vectors (tenant_id, embedding_dimension)';
    EXECUTE 'ALTER TABLE rag.embedding_vectors ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE rag.embedding_vectors FORCE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY embedding_vectors_tenant_isolation ON rag.embedding_vectors FOR ALL USING (tenant_id = identity.current_tenant_id()) WITH CHECK (tenant_id = identity.current_tenant_id())';
  END IF;
END;
$migration$;

-- ---------------------------------------------------------------------------
-- FORCE RLS on every tenant-owned application table. A missing/invalid local
-- setting evaluates to NULL, so policies deny without revealing row metadata.
-- ---------------------------------------------------------------------------

ALTER TABLE rag.municipalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag.municipalities FORCE ROW LEVEL SECURITY;
CREATE POLICY municipalities_tenant_isolation ON rag.municipalities
  FOR ALL USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

ALTER TABLE rag.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag.documents FORCE ROW LEVEL SECURITY;
CREATE POLICY documents_tenant_isolation ON rag.documents
  FOR ALL USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

ALTER TABLE rag.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag.document_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY document_versions_tenant_isolation ON rag.document_versions
  FOR ALL USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

ALTER TABLE rag.document_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag.document_sections FORCE ROW LEVEL SECURITY;
CREATE POLICY document_sections_tenant_isolation ON rag.document_sections
  FOR ALL USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

ALTER TABLE rag.section_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag.section_embeddings FORCE ROW LEVEL SECURITY;
CREATE POLICY section_embeddings_tenant_isolation ON rag.section_embeddings
  FOR ALL USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

ALTER TABLE rag.ingestion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag.ingestion_jobs FORCE ROW LEVEL SECURITY;
CREATE POLICY ingestion_jobs_tenant_isolation ON rag.ingestion_jobs
  FOR ALL USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

ALTER TABLE agent.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent.conversations FORCE ROW LEVEL SECURITY;
CREATE POLICY conversations_tenant_isolation ON agent.conversations
  FOR ALL USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

ALTER TABLE agent.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent.messages FORCE ROW LEVEL SECURITY;
CREATE POLICY messages_tenant_isolation ON agent.messages
  FOR ALL USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

ALTER TABLE agent.runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent.runs FORCE ROW LEVEL SECURITY;
CREATE POLICY runs_tenant_isolation ON agent.runs
  FOR ALL USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

ALTER TABLE agent.retrieval_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent.retrieval_events FORCE ROW LEVEL SECURITY;
CREATE POLICY retrieval_events_tenant_isolation ON agent.retrieval_events
  FOR ALL USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

ALTER TABLE agent.retrieval_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent.retrieval_results FORCE ROW LEVEL SECURITY;
CREATE POLICY retrieval_results_tenant_isolation ON agent.retrieval_results
  FOR ALL USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

ALTER TABLE agent.answer_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent.answer_citations FORCE ROW LEVEL SECURITY;
CREATE POLICY answer_citations_tenant_isolation ON agent.answer_citations
  FOR ALL USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

ALTER TABLE agent.procedure_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent.procedure_feedback FORCE ROW LEVEL SECURITY;
CREATE POLICY procedure_feedback_tenant_isolation ON agent.procedure_feedback
  FOR ALL USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

ALTER TABLE audit.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit.events FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_events_tenant_isolation ON audit.events
  FOR ALL USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

COMMIT;
