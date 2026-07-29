import type { TenantTransactionClient } from "../security/index.js";
import { isCanonicalUuid } from "../security/index.js";

export const PUBLIC_SECTION_PROJECTION = "embedding_vectors_to_document_sections_v1";

export interface PublicSectionProjectionInput {
  tenantId: string;
  documentVersionId: string;
}

export interface PublicSectionProjectionResult {
  tenantId: string;
  documentVersionId: string;
  vectorCount: number;
  sectionCount: number;
  deletedProjectionCount: number;
}

const integer = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error("Public section projection returned an invalid count.");
  }
  return parsed;
};

const rowCount = (result: { rowCount?: number | null }): number => integer(result.rowCount ?? 0);

const ELIGIBILITY_SQL = `
  SELECT count(*)::integer AS vector_count,
         count(DISTINCT vector.ingestion_job_id)::integer AS job_count
  FROM rag.embedding_vectors AS vector
  JOIN rag.document_versions AS version
    ON version.tenant_id = vector.tenant_id
   AND version.id = vector.document_version_id
  JOIN rag.documents AS document
    ON document.tenant_id = version.tenant_id
   AND document.id = version.document_id
  JOIN rag.sources AS source
    ON source.tenant_id = document.tenant_id
   AND source.id = document.source_id
  JOIN rag.artifact_objects AS artifact
    ON artifact.tenant_id = version.tenant_id
   AND artifact.document_version_id = version.id
   AND artifact.status = 'accepted'
   AND artifact.accepted_until > statement_timestamp()
   AND encode(artifact.expected_sha256, 'hex') = version.content_sha256
  JOIN rag.artifact_scans AS scan
    ON scan.tenant_id = artifact.tenant_id
   AND scan.artifact_object_id = artifact.id
   AND scan.id = artifact.accepted_scan_id
   AND scan.verdict = 'clean'
   AND scan.inspection_generation = artifact.inspection_generation
   AND scan.content_sha256 = artifact.expected_sha256
   AND scan.detected_media_type = artifact.declared_media_type
   AND artifact.accepted_until > scan.inspected_at
   AND artifact.accepted_until <= scan.inspected_at + interval '7 days'
  JOIN rag.ingestion_jobs AS job
    ON job.tenant_id = vector.tenant_id
   AND job.id = vector.ingestion_job_id
   AND job.document_version_id = version.id
   AND job.artifact_object_id = artifact.id
   AND job.artifact_scan_id = scan.id
   AND job.status = 'processed'
  WHERE vector.tenant_id = $1::uuid
    AND vector.document_version_id = $2::uuid
    AND vector.contract_version = 1
    AND source.acquisition_state = 'acquired'
    AND source.ingestion_state = 'ingested'
    AND source.retrieval_state = 'indexed'
    AND document.status = 'active'
    AND document.confidentiality = 'public'
    AND version.extraction_status = 'processed'
    AND length(trim(vector.citation_label)) > 0
    AND length(trim(vector.chunk_text)) > 0;
`;

const NON_PROJECTED_SQL = `
  SELECT count(*)::integer AS non_projected_count
  FROM rag.document_sections
  WHERE tenant_id = $1::uuid
    AND document_version_id = $2::uuid
    AND metadata ->> 'projection' IS DISTINCT FROM $3::text;
`;

const DELETE_PROJECTION_SQL = `
  DELETE FROM rag.document_sections
  WHERE tenant_id = $1::uuid
    AND document_version_id = $2::uuid
    AND metadata ->> 'projection' = $3::text;
`;

const INSERT_PROJECTION_SQL = `
  INSERT INTO rag.document_sections (
    id, tenant_id, document_version_id, parent_section_id, section_type,
    section_label, section_number, title, ordinal_path, citation_label,
    page_start, page_end, char_start, char_end, content, content_sha256, metadata
  )
  SELECT
    gen_random_uuid(), vector.tenant_id, vector.document_version_id, NULL,
    'section'::rag.section_type,
    vector.citation_label, vector.article_number, vector.document_title,
    ARRAY[vector.chunk_ordinal], vector.citation_label,
    vector.page_start, vector.page_end, NULL, NULL,
    vector.chunk_text, vector.content_sha256,
    vector.metadata || jsonb_build_object(
      'projection', $3::text,
      'chunk_id', vector.chunk_id,
      'source_type', vector.source_type,
      'section_path', vector.section_path,
      'ingestion_job_id', vector.ingestion_job_id
    )
  FROM rag.embedding_vectors AS vector
  JOIN rag.document_versions AS version
    ON version.tenant_id = vector.tenant_id
   AND version.id = vector.document_version_id
  JOIN rag.documents AS document
    ON document.tenant_id = version.tenant_id
   AND document.id = version.document_id
  JOIN rag.sources AS source
    ON source.tenant_id = document.tenant_id
   AND source.id = document.source_id
  JOIN rag.artifact_objects AS artifact
    ON artifact.tenant_id = version.tenant_id
   AND artifact.document_version_id = version.id
   AND artifact.status = 'accepted'
   AND artifact.accepted_until > statement_timestamp()
   AND encode(artifact.expected_sha256, 'hex') = version.content_sha256
  JOIN rag.artifact_scans AS scan
    ON scan.tenant_id = artifact.tenant_id
   AND scan.artifact_object_id = artifact.id
   AND scan.id = artifact.accepted_scan_id
   AND scan.verdict = 'clean'
   AND scan.inspection_generation = artifact.inspection_generation
   AND scan.content_sha256 = artifact.expected_sha256
   AND scan.detected_media_type = artifact.declared_media_type
   AND artifact.accepted_until > scan.inspected_at
   AND artifact.accepted_until <= scan.inspected_at + interval '7 days'
  JOIN rag.ingestion_jobs AS job
    ON job.tenant_id = vector.tenant_id
   AND job.id = vector.ingestion_job_id
   AND job.document_version_id = version.id
   AND job.artifact_object_id = artifact.id
   AND job.artifact_scan_id = scan.id
   AND job.status = 'processed'
  WHERE vector.tenant_id = $1::uuid
    AND vector.document_version_id = $2::uuid
    AND vector.contract_version = 1
    AND source.acquisition_state = 'acquired'
    AND source.ingestion_state = 'ingested'
    AND source.retrieval_state = 'indexed'
    AND document.status = 'active'
    AND document.confidentiality = 'public'
    AND version.extraction_status = 'processed'
    AND length(trim(vector.citation_label)) > 0
    AND length(trim(vector.chunk_text)) > 0
  ORDER BY vector.chunk_ordinal, vector.chunk_id;
`;

const VERIFY_SQL = `
  SELECT count(*)::integer AS section_count
  FROM rag.document_sections
  WHERE tenant_id = $1::uuid
    AND document_version_id = $2::uuid
    AND metadata ->> 'projection' = $3::text;
`;

export const projectPublicSections = async (
  client: TenantTransactionClient,
  input: PublicSectionProjectionInput
): Promise<PublicSectionProjectionResult> => {
  if (!isCanonicalUuid(input.tenantId) || !isCanonicalUuid(input.documentVersionId)) {
    throw new Error("Public section projection requires canonical tenant and document-version UUIDs.");
  }

  const values = [input.tenantId.toLowerCase(), input.documentVersionId.toLowerCase()];
  const eligibility = await client.query(ELIGIBILITY_SQL, values) as {
    rows: Array<{ vector_count: unknown; job_count: unknown }>;
  };
  const vectorCount = integer(eligibility.rows[0]?.vector_count);
  const jobCount = integer(eligibility.rows[0]?.job_count);
  if (vectorCount < 1 || jobCount !== 1) {
    throw new Error("Public section projection requires one accepted processed vector generation.");
  }

  const existing = await client.query(NON_PROJECTED_SQL, [...values, PUBLIC_SECTION_PROJECTION]) as {
    rows: Array<{ non_projected_count: unknown }>;
  };
  if (integer(existing.rows[0]?.non_projected_count) !== 0) {
    throw new Error("Public section projection refuses to replace non-projected document sections.");
  }

  const deletedResult = await client.query(
    DELETE_PROJECTION_SQL,
    [...values, PUBLIC_SECTION_PROJECTION]
  ) as { rowCount?: number | null };
  const deletedProjectionCount = rowCount(deletedResult);
  const insertedResult = await client.query(
    INSERT_PROJECTION_SQL,
    [...values, PUBLIC_SECTION_PROJECTION]
  ) as { rowCount?: number | null };
  const inserted = rowCount(insertedResult);
  const verified = await client.query(VERIFY_SQL, [...values, PUBLIC_SECTION_PROJECTION]) as {
    rows: Array<{ section_count: unknown }>;
  };
  const sectionCount = integer(verified.rows[0]?.section_count);
  if (inserted !== vectorCount || sectionCount !== vectorCount) {
    throw new Error("Public section projection did not preserve the complete accepted vector generation.");
  }

  return {
    tenantId: input.tenantId.toLowerCase(),
    documentVersionId: input.documentVersionId.toLowerCase(),
    vectorCount,
    sectionCount,
    deletedProjectionCount,
  };
};
