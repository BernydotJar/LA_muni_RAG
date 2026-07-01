# Retrieval Baseline

Last updated: 2026-06-22
Owner: Product Engineering
Status: Draft

## Objective

Validate that PostgreSQL can retrieve cited PDM-OT evidence before adding an
LLM or embeddings.

## Query Files

- `db/queries/pdm_ot_keyword_search.sql`
- `db/queries/pdm_ot_phrase_search.sql`

## How To Test In pgAdmin

Open:

```text
/Users/eduardosacahui/Github-Repos/LA_muni_RAG/db/queries/pdm_ot_keyword_search.sql
```

Edit this value:

```sql
'ordenamiento territorial'::text AS query_text
```

Try:

- `ordenamiento territorial`
- `desarrollo municipal`
- `uso del suelo`
- `movilidad`
- `riesgo`
- `agua potable`

Then open:

```text
/Users/eduardosacahui/Github-Repos/LA_muni_RAG/db/queries/pdm_ot_phrase_search.sql
```

Edit this value:

```sql
'CNPAG'::text AS phrase
```

Try:

- `CNPAG`
- `Consejo Municipal`
- `Catastro`
- `IUSI`
- `SEGEPLAN`

## Mentor Note

Keyword retrieval is the baseline. Semantic retrieval is more flexible, but a
legal-municipal agent also needs exact lookup for acronyms, article numbers,
act numbers, names, and phrases.

Production RAG usually needs both:

- exact search for precision
- semantic search for recall

