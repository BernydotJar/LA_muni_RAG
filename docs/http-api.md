# HTTP API

Last updated: 2026-06-22
Owner: Product Engineering
Status: Draft

## Objective

Expose cited retrieval through a small TypeScript HTTP API without adding a web
framework yet.

## Run

```bash
npm run dev:start
```

Default URL:

```text
http://localhost:4010
```

`dev:start` first frees the project ports `4000`, `4010`, and `4011`, then
starts the API on `4010`.

If you only need to free ports without starting the server:

```bash
npm run ports:kill
```

For lower-level development you can still run the API without port cleanup:

```bash
npm run dev:api
```

Set another port for `dev:api` with:

```bash
PORT=4010 npm run dev:api
```

## Endpoints

### Health

```http
GET /health
```

Expected response:

```json
{
  "status": "ok",
  "service": "la-muni-rag-api"
}
```

### Search

```http
GET /api/search?mode=keyword&q=ordenamiento%20territorial&limit=5
GET /api/search?mode=phrase&q=CNPAG&limit=5
```

Parameters:

- `mode`: `keyword` or `phrase`; defaults to `keyword`
- `q`: required search text
- `limit`: optional integer from 1 to 50; defaults to 10

### Evidence

```http
GET /api/evidence?mode=keyword&q=ordenamiento%20territorial&limit=5
GET /api/evidence?mode=phrase&q=CNPAG&limit=5
```

Expected response:

```json
{
  "query": "CNPAG",
  "mode": "phrase",
  "answerStatus": "evidence_found",
  "evidenceCount": 2,
  "evidence": [
    {
      "documentTitle": "Plan de Desarrollo Municipal...",
      "sourceType": "plan",
      "citationLabel": "PDM-OT Antigua Guatemala, pagina 12",
      "pageStart": 12,
      "excerpt": "SIGLAS Y ACRONIMOS...",
      "score": null,
      "retrievalMode": "phrase"
    }
  ]
}
```

`sourceType` is the `document_type` from the database (`plan`, `decree`,
`constitution`, `law`, `regulation`, etc.).

`/api/evidence` is the endpoint the future agent should call before drafting an
answer.

### Deterministic Answer

```http
GET /api/answer?mode=keyword&q=ordenamiento%20territorial&limit=5
GET /api/answer?mode=phrase&q=CNPAG&limit=5
```

Expected response when evidence exists:

```json
{
  "query": "CNPAG",
  "mode": "phrase",
  "answerStatus": "draft_grounded",
  "answerLabel": "draft",
  "answer": "Respuesta preliminar basada en evidencia...",
  "citations": [
    {
      "citationLabel": "PDM-OT Antigua Guatemala, pagina 12",
      "documentTitle": "Plan de Desarrollo Municipal...",
      "sourceType": "plan",
      "pageStart": 12
    }
  ],
  "evidence": [
    {
      "documentTitle": "Plan de Desarrollo Municipal...",
      "sourceType": "plan",
      "citationLabel": "PDM-OT Antigua Guatemala, pagina 12",
      "pageStart": 12,
      "excerpt": "SIGLAS Y ACRONIMOS...",
      "score": null,
      "retrievalMode": "phrase"
    }
  ]
}
```

Expected response when evidence does not exist:

```json
{
  "query": "zzzinexistente123",
  "mode": "keyword",
  "answerStatus": "not_found",
  "answerLabel": "not_found",
  "answer": "No consta evidencia suficiente en el corpus cargado...",
  "citations": [],
  "evidence": []
}
```

`/api/answer` is deterministic. It calls `findEvidence()`, includes citations
when evidence exists, and abstains with `not_found` when the corpus does not
support an answer. It does not call an LLM, create embeddings, or mutate the
database.

### Agent

```http
GET /api/agent?mode=keyword&q=ordenamiento%20territorial&limit=5
GET /api/agent?mode=phrase&q=CNPAG&limit=3
```

Expected response:

```json
{
  "query": "CNPAG",
  "responseLabel": "evidence_found",
  "confidence": "medium",
  "evidenceSummary": "Found 2 citations from plan. top score: 0.0800.",
  "evidence": [
    {
      "documentTitle": "Plan de Desarrollo Municipal...",
      "sourceType": "plan",
      "citationLabel": "PDM-OT Antigua Guatemala, pagina 12",
      "pageStart": 12,
      "excerpt": "SIGLAS Y ACRONIMOS...",
      "score": null,
      "retrievalMode": "phrase"
    }
  ],
  "context": {
    "retrievalMode": "phrase",
    "evidenceCount": 2,
    "averageScore": null,
    "topScore": null,
    "sourceTypes": ["plan"],
    "suggestedAction": "answer_from_evidence"
  }
}
```

`responseLabel` values: `evidence_found`, `insufficient_evidence`, `not_found`.

`suggestedAction` values: `answer_from_evidence`, `request_clarification`,
`report_not_found`.

`/api/agent` is the semi-agent endpoint. A future LLM should call this to get
evidence-grounded context before drafting an answer.

### Chat

```http
POST /api/chat
Content-Type: application/json

{
  "message": "ordenamiento territorial",
  "mode": "keyword",
  "limit": 5
}
```

Expected response:

```json
{
  "role": "assistant",
  "content": "Encontré **3 referencias** en Plan Municipal...",
  "citations": [
    {
      "citationLabel": "PDM-OT Antigua Guatemala, pagina 14",
      "sourceType": "plan",
      "pageStart": 14,
      "excerpt": "La planificación territorial..."
    }
  ],
  "meta": {
    "responseLabel": "evidence_found",
    "confidence": "high",
    "evidenceCount": 3,
    "suggestedAction": "answer_from_evidence"
  }
}
```

Parameters:

- `message`: required — the user's question
- `mode`: `keyword` or `phrase`; defaults to `keyword`
- `limit`: optional integer from 1 to 50; defaults to 5

`/api/chat` is the endpoint the widget calls. It returns human-readable
Spanish content with markdown formatting, plus structured citation cards.

## CORS

All API responses include `Access-Control-Allow-Origin: *` to allow the widget
to be embedded on any domain. Preflight `OPTIONS` requests are handled
automatically.

## Chat Widget

### Embedding

Add one line before `</body>` on any webpage:

```html
<script src="http://your-server:4010/widget.js"></script>
```

The widget auto-detects the API URL from its own script `src`. To override:

```html
<script src="http://cdn/widget.js" data-api-url="http://api:4010"></script>
```

### Configuration

| Attribute | Default | Description |
|-----------|---------|-------------|
| `data-api-url` | auto-detect from `src` | API base URL |
| `data-position` | `right` | `right` or `left` |
| `data-theme` | `dark` | `dark` or `light` |
| `data-title` | `Asistente Municipal` | Chat window title |

### Demo Page

Visit `http://localhost:4010/` for a live demo page showing the widget in
action with embedding instructions.

### Static Files

The server serves files from the `public/` directory:

- `GET /` → `public/index.html` (demo page)
- `GET /widget.js` → the embeddable chat widget

## Mentor Note

This API is intentionally thin. It does not know SQL. It calls `src/search.ts`.

That boundary matters:

- `src/search.ts` owns retrieval.
- `src/server.ts` owns HTTP transport and static files.
- `src/evidence.ts` owns evidence packaging.
- `src/answer.ts` owns deterministic grounded answers.
- `src/agent.ts` owns reasoning (sufficiency, confidence, summary).
- `src/chat.ts` owns chat response formatting (Spanish, markdown, citations).
- `public/widget.js` owns the embeddable UI (Shadow DOM, self-contained).
- future LLM tools should call the agent layer through the same interface
  instead of duplicating retrieval or reasoning logic.
