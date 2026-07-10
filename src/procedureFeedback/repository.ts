import type { Pool, QueryResultRow } from "pg";
import { pool } from "../db.js";
import type {
  ProcedureFeedbackFilters,
  ProcedureFeedbackInput,
  ProcedureFeedbackListResult,
  ProcedureFeedbackRecord,
  ProcedureFeedbackRepository,
} from "./types.js";

interface ProcedureFeedbackRow extends QueryResultRow {
  id: string;
  workflow_id: string;
  workflow_title: string;
  procedure_type: ProcedureFeedbackRecord["procedureType"];
  jurisdiction: ProcedureFeedbackRecord["jurisdiction"];
  confidence: ProcedureFeedbackRecord["confidence"];
  query: string;
  step_number: string;
  step_title: string;
  feedback_type: ProcedureFeedbackRecord["feedbackType"];
  comment: string;
  is_external_reference: boolean;
  created_at: Date | string;
  retention_until: Date | string;
  total_count?: string | number;
}

const iso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const mapRow = (row: ProcedureFeedbackRow): ProcedureFeedbackRecord => ({
  id: row.id,
  workflowId: row.workflow_id,
  workflowTitle: row.workflow_title,
  procedureType: row.procedure_type,
  jurisdiction: row.jurisdiction,
  confidence: row.confidence,
  query: row.query,
  stepNumber: row.step_number,
  stepTitle: row.step_title,
  feedbackType: row.feedback_type,
  comment: row.comment,
  isExternalReference: row.is_external_reference,
  createdAt: iso(row.created_at),
  retentionUntil: iso(row.retention_until),
});

export class PostgresProcedureFeedbackRepository implements ProcedureFeedbackRepository {
  constructor(private readonly db: Pick<Pool, "query"> = pool) {}

  async create(input: ProcedureFeedbackInput): Promise<ProcedureFeedbackRecord> {
    const result = await this.db.query<ProcedureFeedbackRow>(
      `
        INSERT INTO agent.procedure_feedback (
          workflow_id,
          workflow_title,
          procedure_type,
          jurisdiction,
          confidence,
          query,
          step_number,
          step_title,
          feedback_type,
          comment
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING
          id,
          workflow_id,
          workflow_title,
          procedure_type,
          jurisdiction,
          confidence,
          query,
          step_number,
          step_title,
          feedback_type,
          comment,
          is_external_reference,
          created_at,
          retention_until;
      `,
      [
        input.workflowId,
        input.workflowTitle,
        input.procedureType,
        input.jurisdiction,
        input.confidence,
        input.query,
        input.stepNumber,
        input.stepTitle,
        input.feedbackType,
        input.comment,
      ]
    );

    const row = result.rows[0];
    if (!row) throw new Error("Procedure feedback insert did not return a record");
    return mapRow(row);
  }

  async list(filters: ProcedureFeedbackFilters): Promise<ProcedureFeedbackListResult> {
    const conditions: string[] = ["retention_until > now()"];
    const params: unknown[] = [];

    if (filters.feedbackType) {
      params.push(filters.feedbackType);
      conditions.push(`feedback_type = $${params.length}`);
    }

    if (filters.workflowId) {
      params.push(filters.workflowId);
      conditions.push(`workflow_id = $${params.length}`);
    }

    params.push(filters.limit);
    const limitParameter = `$${params.length}`;

    const result = await this.db.query<ProcedureFeedbackRow>(
      `
        SELECT
          id,
          workflow_id,
          workflow_title,
          procedure_type,
          jurisdiction,
          confidence,
          query,
          step_number,
          step_title,
          feedback_type,
          comment,
          is_external_reference,
          created_at,
          retention_until,
          count(*) OVER() AS total_count
        FROM agent.procedure_feedback
        WHERE ${conditions.join(" AND ")}
        ORDER BY created_at DESC
        LIMIT ${limitParameter};
      `,
      params
    );

    const totalValue = result.rows[0]?.total_count ?? 0;
    return {
      items: result.rows.map(mapRow),
      total: Number(totalValue),
    };
  }
}
