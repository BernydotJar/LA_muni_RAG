# Local CLI

Last updated: 2026-06-22
Owner: Product Engineering
Status: Draft

## Objective

Run retrieval from application code, not only from pgAdmin.

## Setup

Create a local `.env`:

```bash
cp .env.example .env
```

Edit `.env`:

```text
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/la_muni_rag
```

Use the username shown in pgAdmin if it is not `postgres`.

## Commands

Keyword search:

```bash
npm run search -- --keyword "ordenamiento territorial" --limit 5
```

Phrase search:

```bash
npm run search -- --phrase "CNPAG" --limit 5
```

Typecheck:

```bash
npm run typecheck
```

Build:

```bash
npm run build
```

## Expected Output

The search command returns JSON with citation-ready results:

```json
{
  "mode": "keyword",
  "query": "ordenamiento territorial",
  "results": [
    {
      "documentTitle": "...",
      "citationLabel": "PDM-OT Antigua Guatemala, pagina 14",
      "pageStart": 14,
      "keywordScore": 0.1,
      "snippet": "..."
    }
  ]
}
```

## Mentor Note

This CLI is the first application boundary. pgAdmin proves the database works;
the CLI proves our code can retrieve evidence through a controlled interface.

The future API and agent should call the same retrieval functions rather than
duplicating SQL in multiple places.

