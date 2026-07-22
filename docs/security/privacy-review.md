# Privacy review

Status: pre-production review; legal decisions and named owner pending
Last reviewed: 2026-07-21
Technical owner: Product Engineering
Privacy/Legal owner: pending human assignment

## Decision summary

LA Muni RAG should process public municipal sources and the minimum identity, request, feedback, and audit metadata required to deliver tenant-scoped procedural intelligence. It is not approved to ingest internal electoral/campaign data, voter or supporter records, political segments, campaign CRM data, private communications, editorial calendars, or Content Agency production/performance data.

This review is not a legal opinion, data protection impact assessment, or assertion of compliance with Guatemalan or other law. The lawful basis, controller/processor roles, notices, data-subject request channel and deadlines, international transfers, vendor terms, and records-retention duties require a named Privacy/Legal owner before production. No production privacy audit or data-subject request exercise has been performed.

## Product boundary

Permitted cross-product context is limited to approved opaque tenant/request/resource identifiers and the minimum case facts necessary for a procedural query. LA Muni RAG may return versioned evidence, procedures, assessments, and ClaimPacks with citations and limitations. It must not become a shadow system of record for OS Electoral or Content Agency.

If an integration payload contains internal campaign strategy, voter-level data, sensitive political inference, private content drafts, or unrelated personal data, the adapter must reject or minimize it before persistence, retrieval, model context, logging, or backup. Schema validity does not make data appropriate to collect.

## Data inventory and purpose

| Category | Examples | Purpose | Classification / current status |
|---|---|---|---|
| Public municipal source | laws, regulations, plans, forms, official URLs | evidence retrieval and procedural compilation | public when authority and version are verified |
| Derived evidence | extracted text, chunks, embeddings, citations, contradictions | retrieval and traceability | inherits source and tenant restrictions; not automatically public |
| Query/case content | question, jurisdiction, limited case facts, missing evidence | answer, assess a procedure, or derive a ClaimPack | may contain personal or confidential data; minimize and do not log bodies by default |
| Account/integration identity | principal ID, tenant membership, roles, credential digest/status | authentication, authorization, accountability | protected security metadata; raw tokens must not be stored |
| Feedback and workflow review | rating, type, notes, workflow/step/source references | quality improvement and correction | may identify an operator or case; schema currently sets a 180-day visibility window but no purge job is evidenced |
| ClaimPack replay state | tenant/principal IDs, key/request digests, validated response, audit ID, expiry | exact replay and abuse control | protected tenant data; request body, Bearer token, brief, copy, and publication assets are excluded |
| EvidenceGap intake/replay | bounded subject, missing-document need, reason, opaque campaign ref, IDs, response, hashes and audit | track unresolved documentary research and exact replay | protected tenant data; may contain personal/confidential context; no raw key/token or authority claim; retention not approved |
| Audit/security metadata | request/correlation ID, actor ID, tenant ID, action, outcome, safe reason | security, investigation, change accountability | protected; exact retention and access review pending |
| Operational telemetry | latency, error/rate-limit counts, database health | reliability and abuse detection | aggregate/minimize; no credentials, bodies, prompts, or sensitive URLs |
| Backup | database and required versioned storage snapshot | disaster recovery | inherits all contained classifications; encryption/access controls pending platform selection |

The source inventory is incomplete and not a full personal-data inventory. Each new dataset, model provider, analytics tool, support tool, or integration requires an update to this table and a Privacy/Legal decision.

## Data minimization rules

- Collect a stable opaque principal ID rather than names, email addresses, or free-form profile data unless a reviewed use case requires them.
- Derive tenant and role from authenticated server-side state; do not preserve client assertions as trusted identity evidence.
- Keep query/case facts out of ordinary logs, metric labels, traces, error messages, idempotency keys, and URLs.
- Hash or otherwise protect credential and idempotency material; never log raw Bearer tokens, database URLs, cookies, or secret-manager references containing values.
- Store document bytes and extracted content only when source authority, purpose, tenant, confidentiality, version, and provenance are known.
- Avoid copying full external payloads for audit. ClaimPack audit stores safe IDs,
  hashes, action, outcome, and reason only. EvidenceGap audit likewise excludes
  subject, missing-document text, reason and campaign reference even though the
  tenant-owned aggregate stores those bounded domain fields.
- Do not use production queries, feedback, or case content for model training or evaluation without a separate approved purpose, notice, minimization plan, and dataset review.
- Do not place sensitive or personal information in the public Pages artifact.

## Retention and deletion

Retention is not fully approved. The following are decision records, not promises:

| Category | Repository behavior | Required human decision before production |
|---|---|---|
| Public official source/version | versioned preservation is part of evidence provenance | legal/archive duty, supersession policy, and deletion exception |
| Query/case content | no complete server-side case lifecycle exists | whether content is persisted, purpose, duration, tenant deletion, and legal hold |
| Feedback | `retention_until` defaults to 180 days and expired rows are excluded from normal reads | physical deletion job, exception/legal hold, and owner approval |
| Audit/security events | schema/foundation exists but operational retention is not set | minimum/maximum duration, immutable storage, access review, and legal hold |
| Idempotency/rate-limit records | ClaimPack and EvidenceGap replay expire after 24 hours and per-principal rate buckets are cleaned opportunistically; no scheduled purge proof exists | shortest operational window, physical purge/backup aging, and collision/investigation needs |
| EvidenceGap aggregate | immutable `open` request is preserved; no delete/update route exists | purpose, tenant-visible retention, resolution event model, legal hold and deletion exception |
| Operational logs/traces | centralized service not selected | field allowlist, duration, sampling, regional storage, vendor access, and deletion |
| Backups | no production backup service or completed restore drill | RPO/RTO, retention generations, encryption, legal hold, secure disposal |

An expired record is not necessarily deleted. Product behavior, database purge, backup aging, derived embeddings, search indexes, audit/legal holds, and external processors must all be covered by an approved deletion workflow. Until that workflow exists, the product must not tell a person that deletion is complete.

## Data-subject request procedure (design, not yet operated)

The Privacy/Legal owner must establish an intake channel, jurisdiction-specific deadlines, identity-verification standard, authorized operators, and appeal/escalation path. A request should then follow this controlled flow:

1. Record a case ID without copying unnecessary identity documents into the product or ticket.
2. Verify requester identity and tenant scope through an approved secure process; support agents must not use query knowledge as authentication.
3. Search approved systems using stable identity/tenant references, including active rows, derived indexes, audit exceptions, backups, and documented processors.
4. Classify the request (access, correction, deletion, restriction, objection, portability, or another applicable right) without promising that every right applies.
5. Have Privacy/Legal decide public-record, evidentiary, security-audit, legal-hold, third-party, and municipal obligations.
6. Export only the requester's authorized data using a secure transfer; redact other tenants, operators, sources, and security metadata.
7. Execute approved correction/deletion/restriction across primary and derived stores, or record the lawful reason and scope for denial/retention.
8. Verify completion, record a minimized audit event, communicate the outcome, and track backup aging separately.

Current blockers: no named Privacy/Legal owner, no published intake channel/SLA, no identity-verification procedure, no complete data map, and no automated export/deletion tooling. Therefore this section must not be represented as an operational DSAR capability.

## Security and privacy controls

Required controls include TLS, tenant-aware authentication/RBAC/RLS, least-privilege database and backup roles, secret management and rotation, encryption at rest, approved regional storage, safe logging, audit access controls, dependency/container scanning, and incident escalation. The repository does not demonstrate all of them in production.

The public Pages product contains public static assets only and manufactures no evidence responses. Browser storage used by public case/training UI is not a durable municipal record and can expose data to anyone with access to the same browser profile. It must not be used for personal, internal, restricted, or legally authoritative case information.

## Vendors, models, and transfers

No production hosting region, model provider, analytics vendor, logging vendor, support processor, or backup provider is selected in this review. Before selection, the Privacy/Legal and Security owners must review:

- controller/processor/subprocessor roles and contractual terms;
- processing location and international transfer mechanism;
- provider retention, training, human review, abuse monitoring, and deletion behavior;
- encryption and tenant isolation;
- incident notification and audit evidence;
- exit/export/deletion plan and vendor lock-in.

No sensitive query or document may be sent to a model provider merely because an API integration is technically available.

## Privacy incident handling

Suspected cross-tenant access, credential exposure, misdirected export, unauthorized corpus ingestion, public artifact leakage, or vendor disclosure must enter the incident-response process immediately. Preserve evidence without further copying the affected content. Privacy/Legal decides notification obligations and timing; this repository does not define a statutory deadline.

See [Incident response](../operations/incident-response.md) and [Threat model](./threat-model.md).

## Approval checklist

Production approval remains blocked until all of these have named evidence:

- Privacy/Legal owner and product data owner assigned;
- lawful purpose/basis and controller/processor roles recorded;
- data map, classification, notices, consent/authorization where applicable, and external processors approved;
- retention, deletion, legal hold, backup aging, and DSAR workflow approved and tested;
- internal electoral/campaign data exclusion enforced at integration boundaries;
- tenant isolation and safe logging verified end to end;
- incident contacts and notification decision path exercised;
- residual risks explicitly accepted by authorized humans.

## ProcedureAssessment replay minimization

`ProcedureAssessment` is replayable through the shared procedure-query
idempotency store. To prevent that replay table from becoming an implicit case
notes database, the response keeps only opaque `subject_reference`,
`community_id`, and `provided_documents` references. Narrative `facts` and
`constraints` from the request are not copied to the response bytes. The request
body is still parsed transiently and contributes to the scoped request digest,
but raw narratives are not audited or persisted by this provider. A future
procedure-case service must define its own lawful purpose, retention, access,
redaction, and deletion controls before storing narrative case context.
