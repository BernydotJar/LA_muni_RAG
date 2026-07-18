# Feature 053 — Municipal Source Corpus Foundation

## Goal

Establish a versioned, evidence-first source inventory for La Antigua Guatemala and a clearly bounded comparative inventory for other municipalities, beginning with Mixco.

This feature does not claim that a registered source is acquired or ingested. It introduces the contracts, validation rules, source manifest, authority boundaries, deterministic tests, and acquisition runbook required before document-library operations.

## Problem

The repository already has an operational corpus backfill manifest. That manifest records indexing outcomes keyed by document key. It is not a documentary source inventory and must not be used to claim that a source has been located, authenticated, acquired, extracted, or ingested.

The system also uses title and source-type heuristics to classify authority. Those heuristics are insufficient for jurisdiction-sensitive municipal procedure work. Explicit source metadata must take priority.

## Scope

### Source inventory contract

Each source record must include:

- stable source id;
- stable document key;
- title;
- source category;
- target jurisdiction;
- source jurisdiction;
- source municipality when applicable;
- authority class;
- authority level;
- whether the publisher is official for the source jurisdiction;
- whether it is official for the target jurisdiction;
- public URL when identified;
- verification timestamp when verified;
- source version or publication date when known;
- acquisition state;
- content hash only after acquisition;
- acquired artifact path only after acquisition;
- extraction and indexing evidence only after those operations succeed;
- limitations;
- provenance notes.

### Required states

- `missing_source`
- `identified`
- `verified`
- `acquisition_pending`
- `acquired`
- `ingestion_pending`
- `ingested`
- `failed`
- `superseded`

### Authority levels

- `primary`: official source for the target municipality and applicable local procedure;
- `national`: national law or regulation;
- `comparative`: official source for another municipality but not official for Antigua;
- `context`: contextual or explanatory source;
- `unknown`: insufficiently classified.

### Authority rules

1. Explicit inventory metadata overrides title heuristics.
2. A source from another municipality cannot be `primary` for Antigua.
3. A source with unknown source jurisdiction cannot be promoted to `primary`.
4. National law does not set `hasAntiguaEvidence=true` by itself.
5. Mixco records must be official for Mixco and comparative for Antigua.
6. The Mixco limitation must survive serialization:

   `Referencia comparativa de la Municipalidad de Mixco; no define por sí sola el procedimiento oficial de Antigua Guatemala.`

### State rules

1. `missing_source` has no acquisition or ingestion evidence.
2. `identified` and `verified` do not imply acquisition.
3. `acquired` requires a content SHA-256 and acquired artifact path.
4. `ingestion_pending` requires acquisition evidence.
5. `ingested` requires acquisition evidence, extraction evidence, indexing evidence, and positive section/chunk counts.
6. A failed source remains auditable and includes stable failure codes.
7. Superseded records remain visible and identify their replacement when known.
8. The inventory is append-friendly and preserves document versions.

### Idempotency

The stable inventory identity is:

`sourceId + documentVersion + contentSha256 when acquired`

Before acquisition, duplicate `sourceId + documentVersion` records are rejected. After acquisition, the same identity is idempotent; a different content hash for the same declared version is a conflict requiring review.

## Initial inventory

The versioned manifest must include:

- priority Antigua sources;
- applicable national sources;
- at least the required Mixco comparative manual categories;
- explicit missing-source records for Antigua documents not located;
- zero false claims of acquisition or ingestion.

Official landing pages may be registered as `verified` or `acquisition_pending` when the page is verified but the underlying document bytes have not been acquired.

## Non-goals

- authenticated document upload UI;
- automatic downloading;
- database writes;
- production migrations;
- workflow extraction or approval lifecycle;
- water-project workflow;
- multi-tenancy;
- campaign operations;
- deployment.

## Deliverables

- `src/sources/sourceInventory.ts`
- `src/sources/sourceInventoryManifest.ts`
- `.rag/source-inventory.v1.json`
- `src/__tests__/municipal-source-inventory.test.ts`
- `docs/municipal-source-inventory.md`
- `docs/053-requirements-traceability.md`
- `docs/053-decision-log.md`
- `docs/053-risk-register.md`
- progress and issue updates
- draft PR

## Acceptance criteria

- [ ] Inventory validates deterministically.
- [ ] Every record has explicit target and source jurisdiction.
- [ ] Mixco remains comparative for Antigua.
- [ ] National law alone does not count as Antigua municipal evidence.
- [ ] Unknown or external municipalities cannot become primary through title heuristics.
- [ ] Missing sources are represented explicitly.
- [ ] No record claims acquisition without hash and artifact evidence.
- [ ] No record claims ingestion without extraction and indexing evidence.
- [ ] Duplicate and conflicting versions are detected.
- [ ] Manifest contains no secrets or local absolute paths.
- [ ] Existing corpus manifest and backfill behavior remain unchanged.
- [ ] Typecheck, build, focused tests, domain evaluation, full tests, Pages verification, and diff checks pass.

## Review questions

- Did any template become evidence?
- Did any Mixco source become authority for Antigua?
- Did any national source become local municipal implementation evidence?
- Did a registered URL become an ingestion claim?
- Did any missing document receive a fabricated URL, version, hash, deadline, responsible unit, form, system, or approval?
- Can conflicting source versions be silently promoted?
