# Feature 090 — Governed official HTML acquisition v1

## Status

Approved for safe repository and local-workspace execution by the product owner in this product-completion session. Managed database mutation, public projection, merge and deployment remain human-gated.

## Problem

Feature 089 registers official national discovery sources but intentionally leaves them outside retrieval. A SaaS tenant needs a repeatable acquisition boundary that converts an approved source-pack binding into immutable, scanned and extractable local evidence without assuming that every official endpoint is accessible or substantively useful.

## Objective

Implement and execute a tenant-reusable HTML acquisition workflow that:

- resolves sources only through a governed non-template source pack and source inventory;
- attempts all 16 enabled national HTML bindings;
- accepts only HTTPS endpoints, exact allowlisted hosts and public DNS addresses;
- rejects cross-host or excessive redirects, oversized bodies, unsupported media, unsafe encodings, malware and insufficient extracted content;
- stores exact source bytes and normalized extraction outside Git under a mode-restricted library root;
- records SHA-256, byte length, structural signature, ClamAV identity and extraction count;
- advances only successful sources to `ingestion_pending`;
- leaves blocked sources at `verified` and records stable failure codes;
- performs no indexing, Cloud SQL mutation or deployment.

## Functional requirements

### FR-1 — Governed plan

The acquisition plan SHALL identify one existing non-template source pack and an explicit bounded list of inventory IDs. Every ID SHALL be bound exactly once to an enabled `html_page` connector.

### FR-2 — Network boundary

Each request hop SHALL use HTTPS, contain no credentials, match exact connector and pack host allowlists, and resolve only to public IP addresses. Redirects SHALL be manual, bounded and revalidated at every hop.

### FR-3 — Bounded bytes

Responses SHALL be HTTP 200, declare `text/html` or `application/xhtml+xml`, and remain below the configured decompressed byte limit. Partial or oversized responses SHALL NOT be published.

### FR-4 — Encoding and structure

UTF-8 SHALL be accepted. ISO-8859-1 / Windows-1252 MAY be accepted only for HTML with a declared charset and recognizable HTML structure. The raw source bytes remain the acquired artifact; extraction SHALL decode with the recorded charset.

### FR-5 — Malware gate

A real ClamAV scanner with identifiable engine and definitions SHALL inspect a private mode-0600 snapshot. Only a complete `clean` result MAY publish the artifact or update inventory evidence.

### FR-6 — Immutable local storage

Successful content SHALL be stored below an absolute library root at a content-addressed path containing source pack, snapshot date, source ID and SHA-256. Directories SHALL use mode 0700 and files mode 0600. Existing content MAY be reused only after exact hash and size verification.

### FR-7 — Extraction quality

The governed HTML extractor SHALL remove executable elements and produce bounded citable sections. A source SHALL be blocked when extracted text or section count is below the configured threshold.

### FR-8 — Inventory semantics

Successful records SHALL become `ingestion_pending` with matching acquisition, clean artifact-safety and extraction evidence. Blocked records SHALL remain `verified`; the receipt, not the authority state, records the failed attempt. No record SHALL become `ingested` in this node.

### FR-9 — Partial completion

The run MAY pass with documented blockers when at least 10 of the 16 governed sources succeed and every other source has a stable failure code. The receipt SHALL enumerate attempted, successful and blocked sources.

### FR-10 — No raw content in Git

Raw HTML and extracted section bodies SHALL remain under ignored `.rag/library`. Git SHALL contain configuration, code, inventory metadata, tests and receipts only.

## Non-functional requirements

- Deterministic unit tests with injected DNS, fetch and scanner dependencies.
- No shell interpolation for scanner execution.
- Atomic inventory and receipt writes.
- No silent redirect following.
- No private-network fallback.
- No legal-vigencia or case-occurrence claim.
- No production credentials required.

## Acceptance criteria

1. The pure acquisition engine blocks unknown/unbound IDs, private DNS, cross-host redirects, oversized content, invalid media, malware and insufficient extraction.
2. ISO-8859-1 HTML is structurally inspected and extracted without corrupting raw bytes.
3. The live run attempts 16 sources and succeeds for at least 10 with complete clean evidence.
4. Successful inventory records are `ingestion_pending`; blocked records remain `verified`; zero new records are `ingested`.
5. The library root is outside Git and all successful bytes match inventory hashes and receipt hashes.
6. Critic/red-team and independent verifier reproduce the security and state-transition gates.
7. Full tests, typecheck, build, inventory, source packs, tenant profiles, Graph Harness and remote CI pass on the exact functional head.

## Explicit exclusions

- Following links to acquire referenced PDFs or forms.
- OCR.
- Embedding generation or indexing.
- Cloud SQL or managed object-store mutation.
- Public retrieval projection.
- PR merge or deployment.
