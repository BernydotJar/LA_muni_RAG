-- LA Muni RAG
-- ProcedureWorkflow feedback persistence.

BEGIN;

CREATE TABLE IF NOT EXISTS agent.procedure_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id TEXT NOT NULL CHECK (char_length(workflow_id) BETWEEN 1 AND 200),
  workflow_title TEXT NOT NULL CHECK (char_length(workflow_title) BETWEEN 1 AND 300),
  procedure_type TEXT NOT NULL CHECK (procedure_type IN (
    'public_works', 'procurement', 'project_execution', 'project_closure',
    'budget', 'community_request', 'cocode', 'council_approval', 'unknown'
  )),
  jurisdiction TEXT NOT NULL CHECK (jurisdiction IN (
    'Antigua Guatemala', 'Guatemala national', 'external reference'
  )),
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  query TEXT NOT NULL CHECK (char_length(query) BETWEEN 1 AND 1200),
  step_number TEXT NOT NULL CHECK (char_length(step_number) BETWEEN 1 AND 32),
  step_title TEXT NOT NULL CHECK (char_length(step_title) BETWEEN 1 AND 300),
  feedback_type TEXT NOT NULL CHECK (feedback_type IN (
    'missing_document', 'wrong_or_unclear_step', 'unclear_responsible',
    'missing_legal_basis', 'missing_deadline', 'missing_case_evidence', 'other'
  )),
  comment TEXT NOT NULL CHECK (char_length(comment) BETWEEN 1 AND 1200),
  is_external_reference BOOLEAN GENERATED ALWAYS AS (jurisdiction = 'external reference') STORED,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  retention_until TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '180 days')
);

CREATE INDEX IF NOT EXISTS procedure_feedback_created_idx
  ON agent.procedure_feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS procedure_feedback_workflow_idx
  ON agent.procedure_feedback (workflow_id, created_at DESC);
CREATE INDEX IF NOT EXISTS procedure_feedback_type_idx
  ON agent.procedure_feedback (feedback_type, created_at DESC);
CREATE INDEX IF NOT EXISTS procedure_feedback_retention_idx
  ON agent.procedure_feedback (retention_until);

COMMIT;
