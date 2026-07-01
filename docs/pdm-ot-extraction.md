# PDM-OT Extraction

Last updated: 2026-06-22
Owner: Product Engineering
Status: Draft

## Objective

Load page-level text sections from the verified PDM-OT PDF into
`rag.document_sections`.

## Generated Artifacts

Generated locally:

- `artifacts/pdm_ot_sections.jsonl`
- `artifacts/pdm_ot_sections.sql`

Source file:

- `data/raw/core-documents/pdm-ot-antigua-modulo-1.pdf`

Extraction command:

```bash
python3 scripts/extract_pdf_sections.py \
  --pdf data/raw/core-documents/pdm-ot-antigua-modulo-1.pdf \
  --jsonl-out artifacts/pdm_ot_sections.jsonl \
  --sql-out artifacts/pdm_ot_sections.sql \
  --document-title 'Plan de Desarrollo Municipal y Ordenamiento Territorial de Antigua Guatemala, PDM-OT' \
  --version-label 'official-municipal-pdf-2026-06-22'
```

Current result:

- PDF pages: 226
- Extracted sections: 224
- Granularity: one section per text-bearing page
- Method: `pypdf_page_text_v1`

## Load In pgAdmin

Open and run:

```text
/Users/eduardosacahui/Github-Repos/LA_muni_RAG/artifacts/pdm_ot_sections.sql
```

## Validation Queries

```sql
SELECT
  count(*) AS section_count,
  min(page_start) AS first_page,
  max(page_end) AS last_page
FROM rag.document_sections s
JOIN rag.document_versions v ON v.id = s.document_version_id
JOIN rag.documents d ON d.id = v.document_id
WHERE d.title = 'Plan de Desarrollo Municipal y Ordenamiento Territorial de Antigua Guatemala, PDM-OT';
```

```sql
SELECT
  v.page_count,
  v.extraction_status,
  v.extraction_method,
  v.extracted_text_uri
FROM rag.document_versions v
JOIN rag.documents d ON d.id = v.document_id
WHERE d.title = 'Plan de Desarrollo Municipal y Ordenamiento Territorial de Antigua Guatemala, PDM-OT';
```

```sql
SELECT
  citation_label,
  left(content, 500) AS preview
FROM rag.document_sections
WHERE citation_label IN (
  'PDM-OT Antigua Guatemala, pagina 1',
  'PDM-OT Antigua Guatemala, pagina 4',
  'PDM-OT Antigua Guatemala, pagina 226'
)
ORDER BY page_start;
```

## Mentor Note

Page-level extraction is not the final retrieval design. It is a reliable first
corpus layer because it preserves citation boundaries and lets us test keyword
search before more sophisticated section detection.

Later, planning documents can be re-chunked by headings, maps, tables, and
policy sections. Legal documents should be chunked by article, not by page.

