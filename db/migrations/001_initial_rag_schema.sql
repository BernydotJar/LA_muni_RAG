-- LA Muni RAG
-- Initial PostgreSQL schema for a production-grade municipal legal RAG system.
--
-- Run inside the target database, for example:
--   psql "postgresql://USER:PASSWORD@localhost:5432/la_muni_rag" \
--     -f db/migrations/001_initial_rag_schema.sql

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE SCHEMA IF NOT EXISTS rag;
CREATE SCHEMA IF NOT EXISTS agent;
CREATE SCHEMA IF NOT EXISTS audit;

CREATE TYPE rag.document_status AS ENUM (
  'active',
  'superseded',
  'repealed',
  'draft',
  'archived',
  'unknown'
);

CREATE TYPE rag.document_scope AS ENUM (
  'national',
  'departmental',
  'municipal',
  'heritage',
  'administrative',
  'internal'
);

CREATE TYPE rag.document_type AS ENUM (
  'constitution',
  'law',
  'decree',
  'regulation',
  'municipal_agreement',
  'council_minutes',
  'plan',
  'manual',
  'procedure',
  'form',
  'guide',
  'jurisprudence',
  'other'
);

CREATE TYPE rag.source_kind AS ENUM (
  'official_url',
  'official_upload',
  'gazette',
  'internal_upload',
  'third_party_reference',
  'unknown'
);

CREATE TYPE rag.ingestion_status AS ENUM (
  'queued',
  'processing',
  'processed',
  'failed',
  'superseded'
);

CREATE TYPE rag.section_type AS ENUM (
  'document',
  'title',
  'chapter',
  'section',
  'article',
  'clause',
  'paragraph',
  'table',
  'appendix',
  'form_field',
  'other'
);

CREATE TABLE rag.municipalities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'Guatemala',
  slug TEXT NOT NULL UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rag.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id UUID REFERENCES rag.municipalities(id),
  title TEXT NOT NULL,
  document_type rag.document_type NOT NULL,
  document_scope rag.document_scope NOT NULL,
  issuing_authority TEXT,
  source_kind rag.source_kind NOT NULL DEFAULT 'unknown',
  source_url TEXT,
  official_source BOOLEAN NOT NULL DEFAULT false,
  publication_date DATE,
  effective_date DATE,
  repeal_date DATE,
  status rag.document_status NOT NULL DEFAULT 'unknown',
  language_code TEXT NOT NULL DEFAULT 'es',
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT documents_repeal_after_effective_chk CHECK (
    repeal_date IS NULL OR effective_date IS NULL OR repeal_date >= effective_date
  )
);

CREATE TABLE rag.document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES rag.documents(id) ON DELETE CASCADE,
  version_label TEXT NOT NULL,
  source_url TEXT,
  storage_uri TEXT,
  original_filename TEXT,
  mime_type TEXT,
  content_sha256 TEXT NOT NULL,
  page_count INTEGER,
  extraction_status rag.ingestion_status NOT NULL DEFAULT 'queued',
  extraction_method TEXT,
  extracted_text_uri TEXT,
  extracted_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, version_label),
  UNIQUE (content_sha256)
);

CREATE TABLE rag.document_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_version_id UUID NOT NULL REFERENCES rag.document_versions(id) ON DELETE CASCADE,
  parent_section_id UUID REFERENCES rag.document_sections(id) ON DELETE CASCADE,
  section_type rag.section_type NOT NULL,
  section_label TEXT,
  section_number TEXT,
  title TEXT,
  ordinal_path INTEGER[] NOT NULL DEFAULT '{}',
  citation_label TEXT NOT NULL,
  page_start INTEGER,
  page_end INTEGER,
  char_start INTEGER,
  char_end INTEGER,
  content TEXT NOT NULL,
  content_tsv TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('spanish', coalesce(title, '') || ' ' || content)
  ) STORED,
  content_sha256 TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT document_sections_page_range_chk CHECK (
    page_end IS NULL OR page_start IS NULL OR page_end >= page_start
  ),
  CONSTRAINT document_sections_char_range_chk CHECK (
    char_end IS NULL OR char_start IS NULL OR char_end >= char_start
  )
);

CREATE TABLE rag.section_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES rag.document_sections(id) ON DELETE CASCADE,
  embedding_model TEXT NOT NULL,
  embedding_dimensions INTEGER NOT NULL DEFAULT 1536,
  embedding VECTOR(1536) NOT NULL,
  content_sha256 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (section_id, embedding_model)
);

CREATE TABLE rag.ingestion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_version_id UUID REFERENCES rag.document_versions(id) ON DELETE CASCADE,
  status rag.ingestion_status NOT NULL DEFAULT 'queued',
  job_type TEXT NOT NULL,
  requested_by TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error_message TEXT,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agent.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id UUID REFERENCES rag.municipalities(id),
  user_external_id TEXT,
  user_role TEXT NOT NULL DEFAULT 'operator',
  title TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agent.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES agent.conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agent.runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES agent.conversations(id) ON DELETE SET NULL,
  user_message_id UUID REFERENCES agent.messages(id) ON DELETE SET NULL,
  assistant_message_id UUID REFERENCES agent.messages(id) ON DELETE SET NULL,
  model TEXT NOT NULL,
  response_label TEXT NOT NULL CHECK (
    response_label IN ('implemented', 'draft', 'interpretation', 'not_found', 'fallback', 'error')
  ),
  input_tokens INTEGER,
  output_tokens INTEGER,
  latency_ms INTEGER,
  tool_trace JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agent.retrieval_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES agent.runs(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  retrieval_mode TEXT NOT NULL CHECK (retrieval_mode IN ('semantic', 'keyword', 'hybrid', 'exact')),
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agent.retrieval_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retrieval_event_id UUID NOT NULL REFERENCES agent.retrieval_events(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES rag.document_sections(id) ON DELETE RESTRICT,
  rank INTEGER NOT NULL,
  semantic_score DOUBLE PRECISION,
  keyword_score DOUBLE PRECISION,
  combined_score DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (retrieval_event_id, section_id)
);

CREATE TABLE agent.answer_citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES agent.runs(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES rag.document_sections(id) ON DELETE RESTRICT,
  citation_order INTEGER NOT NULL,
  claim_text TEXT,
  citation_label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, citation_order)
);

CREATE TABLE audit.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_external_id TEXT,
  event_type TEXT NOT NULL,
  entity_schema TEXT NOT NULL,
  entity_table TEXT NOT NULL,
  entity_id UUID,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'error', 'blocked')),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX documents_municipality_idx ON rag.documents (municipality_id);
CREATE INDEX documents_status_scope_type_idx ON rag.documents (status, document_scope, document_type);
CREATE INDEX document_versions_document_idx ON rag.document_versions (document_id);
CREATE INDEX document_sections_version_idx ON rag.document_sections (document_version_id);
CREATE INDEX document_sections_parent_idx ON rag.document_sections (parent_section_id);
CREATE INDEX document_sections_citation_idx ON rag.document_sections (citation_label);
CREATE INDEX document_sections_content_tsv_idx ON rag.document_sections USING GIN (content_tsv);
CREATE INDEX section_embeddings_vector_cosine_idx
  ON rag.section_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
CREATE INDEX ingestion_jobs_status_idx ON rag.ingestion_jobs (status, job_type);
CREATE INDEX messages_conversation_created_idx ON agent.messages (conversation_id, created_at);
CREATE INDEX runs_conversation_created_idx ON agent.runs (conversation_id, created_at);
CREATE INDEX retrieval_results_event_rank_idx ON agent.retrieval_results (retrieval_event_id, rank);
CREATE INDEX answer_citations_run_order_idx ON agent.answer_citations (run_id, citation_order);
CREATE INDEX audit_events_type_created_idx ON audit.events (event_type, created_at);

INSERT INTO rag.municipalities (name, department, slug, metadata)
VALUES (
  'Municipalidad de La Antigua Guatemala',
  'Sacatepequez',
  'la-antigua-guatemala-sacatepequez',
  '{"country_subdivision": "Sacatepequez", "product_scope": "municipal_rag"}'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

COMMIT;

