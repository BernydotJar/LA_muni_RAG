# Feature 087 - Public corpus pilot staging v1

## Goal

Deliver a usable public staging pilot in which the existing GitHub Pages frontend queries an immutable Cloud Run backend connected to the approved PDM-OT corpus in managed Cloud SQL.

## Human authorization

The product owner approved the anonymous PDM-OT pilot, Cloud SQL lifecycle, Cloud Run, Artifact Registry, Secret Manager, Pages connection, bounded staging spend, merge and release on 2026-07-29. MFA and productive human identity are deferred and are not part of this anonymous public gateway.

## Requirements

- Reuse `la-muni-rag-staging`; do not create a duplicate Cloud SQL instance or remove deletion protection.
- Use a dedicated database and a non-owner runtime role with no superuser, database-creation, role-creation or RLS-bypass capability.
- Store database and rate-limit secrets only in Secret Manager.
- Publish only accepted, clean, processed, active, public and indexed evidence.
- Make controlled-ingestion chunks consumable by keyword and phrase retrieval through a reproducible bounded projection.
- Normalize ordinary PDF whitespace in public excerpts while continuing to reject unsafe control characters.
- Build an immutable image from an exact Git commit and deploy Cloud Run by digest.
- Allow only the exact GitHub Pages origin; reject browser credentials and foreign origins.
- Configure `PAGES_API_URL`, republish Pages, and verify live evidence, no-answer, CORS, credential rejection and rate limiting.
- Record logs, rollback information, resource identities, image digest, URLs and exact-SHA CI evidence.

## Non-goals

- Productive human authentication, MFA, account recovery or the twelve authenticated browser journeys.
- OCR of the DMP scanner PDF.
- General legal correctness, complete municipal coverage or a production SLO.
- Incorporating RevPDF or PixelRAG.

## Gate

The feature is complete only when local regression, managed-database evidence, public corpus projection, immutable-image evidence, Cloud Run smoke, online Pages smoke, observability evidence and exact-SHA remote CI all pass.
