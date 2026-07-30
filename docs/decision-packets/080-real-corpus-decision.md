# Real municipal corpus decision

Status: pending human decision
Packet ID: `HDP-CORPUS-001`

## Decision required

Approve, reject or defer a bounded set of real municipal sources for acquisition, ingestion, evaluation and permitted use. The receipt must identify authoritative owners, rights/licensing basis, municipalities and document classes, acquisition method, data sensitivity, retention, publication restrictions and evaluation scope.

No action is authorized by this packet alone.

## Current evidence

- Real documents ingested: `0`.
- Real-corpus retrieval evaluation: `0`.
- Existing retrieval, provenance, citation, freshness and evaluation foundations use synthetic or controlled fixtures.
- No rights, records-owner, privacy/legal, acquisition, retention or publication receipt exists for a real corpus.
- LA Muni RAG may maintain provider-side contracts and portable kits, but it must not assume ownership of OS Electoral or Content Agency content/functions.

## Options

### Option A — Approve a small rights-cleared pilot corpus

Authorize a finite source list and document count for a named non-production environment and evaluation purpose. Require source-by-source authority, rights, sensitivity, retention and deletion metadata.

### Option B — Approve a broader managed-staging corpus

In addition to pilot controls, require automated acquisition governance, change detection, source-owner review, document-level access classification, representative evaluation set and an operational correction/removal process.

### Option C — Defer real corpus ingestion

Continue synthetic fixtures, schema/contract tests, source inventory preparation and rights analysis. Do not report retrieval quality as representative of municipal content.

### Option D — Reject one or more proposed sources

Document the rejected source, reason and any permissible metadata-only or link-only alternative.

## Evaluation criteria

- authoritative publisher/records owner and jurisdiction;
- copyright, license, public-records basis, terms of use and redistribution limits;
- document classes, languages, formats, temporal coverage and update frequency;
- presence of personal, confidential, protected, sealed, draft or security-sensitive information;
- acquisition method, robots/API terms, rate limits and source-system impact;
- immutable source identity, versioning, effective dates, supersession and withdrawal;
- retention, correction, deletion, legal hold and backup aging;
- citation/display permissions and downstream consumer restrictions;
- representative evaluation questions, gold evidence and human adjudication;
- contamination prevention between evaluation and tuning datasets;
- total storage/processing cost and owner.

## Preconditions

- source/records owner and privacy/legal approval;
- exact source inventory with URLs/endpoints and document classes;
- documented rights and use restrictions per source;
- sensitivity classification and exclusion/redaction rules;
- retention/deletion/correction and source withdrawal runbooks;
- checksum/version/provenance and authority metadata requirements;
- bounded acquisition rate and failure/retry behavior;
- evaluation design with independent relevance/citation/freshness adjudication;
- access-control decision for tenant-public versus restricted content;
- rollback/removal plan including derived chunks, embeddings, caches, evaluations and backups.

## Prohibited until approval

- crawling, downloading or ingesting real documents;
- using personal accounts, unofficial mirrors or credentials;
- treating public availability as proof of redistribution rights;
- retaining personal/confidential data without an approved purpose and controls;
- publishing restricted source content or derived excerpts;
- using real corpus content to implement OS Electoral or Content Agency capabilities;
- reporting synthetic retrieval results as real-corpus performance.

## Acceptance evidence after approval

- signed source inventory and rights record;
- acquisition receipt with exact source/version/checksum/count;
- document classification, exclusion/redaction and tenant-access evidence;
- ingestion and deletion/correction tests over the approved pilot;
- independently adjudicated real-corpus retrieval/citation/freshness evaluation;
- prohibited-content and PII scans;
- cost/storage receipt and retention schedule;
- rollback/removal evidence including embeddings and backups.

## Decision receipt

Create a separate receipt conforming to `contracts/decision-packets/v1/human-decision-receipt.schema.json` with:

- `packet_id: HDP-CORPUS-001`;
- approved/rejected/deferred outcome;
- authority roles and durable decision record reference;
- exact source list, owner, rights basis and permitted environment/purpose;
- explicitly approved acquisition/ingestion/evaluation actions;
- document-count or storage/time bounds;
- sensitivity, retention, publication and downstream-use constraints;
- required evidence before expansion or production use.
