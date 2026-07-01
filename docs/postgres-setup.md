# PostgreSQL Setup

Last updated: 2026-06-21
Owner: Product Engineering
Status: Draft

## Objective

Create the production database foundation for the La Antigua Guatemala municipal
RAG agent.

## pgAdmin Steps

1. Open pgAdmin.
2. Right-click `Servers`.
3. Select `Register` > `Server`.
4. In `General`, set:
   - Name: `Local PostgreSQL`
5. In `Connection`, set:
   - Host name/address: `localhost`
   - Port: `5432`
   - Maintenance database: `postgres`
   - Username: your local PostgreSQL postgre
   - Password: your local PostgreSQL 85208520
6. Save.
7. Right-click `Databases`.
8. Select `Create` > `Database`.
9. Set database name:
   - `la_muni_rag`
10. Open Query Tool on `la_muni_rag`.
11. Run `db/migrations/001_initial_rag_schema.sql`.

## Mentor Note

For a legal-municipal RAG product, PostgreSQL is not just storage. It is the
evidence ledger. The model may draft language, but the database must preserve
what document was used, which section was cited, which version was active, and
which retrieval step produced the answer.

That is why the initial schema separates:

- documents: what source exists
- document versions: which copy was processed
- document sections: the citable legal/admin fragments
- embeddings: semantic retrieval vectors
- agent runs: what the AI did
- citations: what evidence justified the final answer

