-- 011-production-vector-store
-- Production vector persistence for indexed embedding chunks.
-- Requires pgvector extension to be available in the target PostgreSQL instance.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS rag.embedding_vectors (
  chunk_id text PRIMARY KEY,
  document_key text NOT NULL,
  document_version text NOT NULL,
  document_title text NOT NULL,
  citation_label text NOT NULL CHECK (length(trim(citation_label)) > 0),
  page_start integer,
  page_end integer,
  article_number text,
  source_type text NOT NULL,
  section_path jsonb NOT NULL DEFAULT '[]'::jsonb,
  section_type text NOT NULL,
  chunk_ordinal integer NOT NULL,
  chunk_text text NOT NULL,
  content_sha256 text NOT NULL,
  token_estimate integer NOT NULL,
  embedding_model text NOT NULL,
  embedding_provider text NOT NULL,
  embedding_dimension integer NOT NULL,
  embedding vector(1536) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  indexed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS embedding_vectors_embedding_idx
  ON rag.embedding_vectors
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS embedding_vectors_document_idx
  ON rag.embedding_vectors (document_key, document_version);

CREATE INDEX IF NOT EXISTS embedding_vectors_model_idx
  ON rag.embedding_vectors (embedding_provider, embedding_model, embedding_dimension);
