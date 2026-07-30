# Remaining named hard evals

Feature 066 adds stable names around four areas that already had implementation
and partial tests but lacked a dedicated scope-equivalent release gate.

## EVAL-SOURCE-001

Verifies source inventory structure, authority/jurisdiction distinctions,
comparative warnings, version identity and strict lifecycle semantics. The one
record marked `acquired` contains metadata and checksum in the inventory, but
its ignored library bytes are not present in this checkout. No record is marked
`ingested`. Therefore this eval does not prove durable object possession,
malware scan, extraction, indexing or freshness operations.

## EVAL-MISSING-001

Verifies that absent evidence yields `missing_evidence`, explicit gaps and null
actors/units/deadlines/systems with no citations or approval. It also verifies
that EvidenceGap is open requester-supplied intake and that comparative evidence
cannot become Antigua authority. It does not prove research assignment or gap
resolution against a complete corpus.

## EVAL-RBAC-001

Verifies the exact ten-role matrix, tenant-local transactions, server-side
permission checks, forced RLS gates, uniform denial and separation between case
operation and documentary review. It does not prove human OIDC/session/BFF,
provisioning, periodic access review or every future endpoint.

## EVAL-INGEST-001

Consolidates exact artifact acceptance, bounded durable jobs, SKIP LOCKED,
heartbeat/fencing/retry, atomic tenant vector replacement, rollback, API
idempotency and non-owner PostgreSQL gates. It does not prove a production
object store, scanner definitions service, dispatcher, quotas, cancellation UI,
large real corpus, load/HA or production observability.
