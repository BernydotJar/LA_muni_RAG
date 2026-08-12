# Feature 091 — Public Query Resilience v1

## Goal

Keep the approved public LA Muni RAG experience operational even when the managed Cloud Run / Cloud SQL pilot is intentionally stopped or temporarily unavailable, without manufacturing answers or weakening the existing authority boundaries.

## Problem statement

GitHub Pages currently configures the approved public Cloud Run gateway. The gateway previously passed managed staging and online browser release gates, but the bounded Cloud SQL pilot was later stopped to respect its operational window. The public page therefore remains reachable while `/health`, CORS preflight and the public query endpoint can return HTTP 503. Browser users observe `Failed to fetch` even though a frozen public corpus has already been acquired, scanned, extracted and projected in prior gated work.

## Architecture

The GitHub Pages artifact SHALL contain a read-only static projection derived from exactly three official target-jurisdiction PDM-OT PDFs already recorded as `ingested` in `.rag/source-inventory.json`:

| Source | SHA-256 | Extracted pages |
|---|---|---:|
| `antigua-pdm-ot` | `824f0ee47106f062269a7c65cb3433435470bbe609054972eb29c360f368cd0b` | 224 |
| `antigua-pdmot-module-3` | `dc67c503155c8fe85a6d4ac28b54c715e6293ab8261484d2531750a9ab17a3f0` | 46 |
| `antigua-pdmot-module-4` | `73186847344904a6c4ee64668dad0ec43628b3ca65ed8f12a192a05705a26fa9` | 22 |

The source PDFs SHALL NOT be committed to Git. Snapshot generation is permitted only after reacquired bytes match the exact governed sizes and hashes and after the inventory binds those bytes to an existing clean artifact-safety decision.

The static projection SHALL store normalized public text at page granularity with exact official source URL, document identity, page number and frozen source hash. It is a projection, not a new authoritative corpus.

## Routing policy

GitHub Pages SHALL load the static public resilience layer before `pages-api-bridge.js`.

When Pages is built with an API URL, its three approved public routes SHALL use `static-first` mode:

- `POST /api/public/v1/query`
- `GET /api/procedure`
- `GET /api/domain-pack`

The static layer prevents routine calls to a deliberately stopped managed backend and therefore prevents browser `Failed to fetch` / 503 console noise. A remote-first integration remains supported when `data-static-fallback="static-first"` is absent. In remote-first mode, only transport failure or HTTP 502/503/504 may invoke the static projection; meaningful 4xx, 429 and 500 responses SHALL remain visible and SHALL NOT be silently replaced.

If the Pages build has no configured API URL, the existing fail-closed behavior remains unchanged and the widget stays disabled. The presence of a snapshot alone SHALL NOT implicitly opt an unconfigured embedding into a public data surface.

## Retrieval contract

Static retrieval is deterministic lexical retrieval only. It SHALL NOT claim semantic search, vector similarity, model-generated legal reasoning, server-side audit, productive identity or managed-database freshness.

Keyword mode may use bounded, explicit lexical expansion for previously governed broad-needs language. Phrase mode requires a normalized exact phrase match. Results are bounded and deterministically ordered.

A public citation SHALL include:

- official document title;
- exact page number;
- bounded excerpt derived from that page;
- exact `https://muniantigua.gob.gt/` source URL;
- `official_target_jurisdiction` authority status;
- explicit `undetermined` temporal status unless governed dates prove otherwise.

The public query response SHALL retain the v1 shape consumed by the widget and SHALL disclose that it used a three-document static projection, lexical retrieval and no semantic model.

## Procedure contract

The static procedure route SHALL reuse a client-safe snapshot of the existing `municipal-antigua` domain pack rather than inventing new workflow logic.

A template step may be marked only as:

- `inferred_for_review` when related page-level evidence is retrieved; or
- `missing_evidence` when no related evidence is retrieved.

The static procedure path SHALL NOT label a template step as legally established or mandatory. Missing evidence SHALL produce explicit gaps and a requirement for an applicable official source plus human municipal validation.

## Safety and privacy boundaries

- No raw PDFs in Git or Pages.
- No secrets, cookies, bearer tokens or tenant credentials in static assets.
- No cross-tenant data.
- No search-engine caches or third-party mirrors as evidence.
- No semantic-model claim.
- No productive server-audit claim for static requests.
- No claim that ingestion proves vigencia, applicability, approval or occurrence of a municipal act.
- Source links must remain HTTPS, credential-free and exact.

## Release gate

`GATE-PUBLIC-QUERY-RESILIENCE-004` requires:

1. `source_reacquisition` — exact current official bytes match all three frozen hashes and sizes;
2. `static_projection` — snapshot and domain-pack contracts validate and raw PDFs remain untracked;
3. `browser_smoke` — desktop/mobile browser tests prove query, domain pack and procedure operate in static-first mode without runtime errors;
4. `adversarial_review` — invalid body, unsupported method, unsafe source metadata and non-eligible upstream errors remain fail-closed;
5. `independent_regression` — full repository tests, typecheck, build, Pages verifier, audit and diff checks pass;
6. `remote_ci` — exact functional SHA passes Backend CI and Public Browser Gate;
7. `online_pages` — merged exact release SHA is served by GitHub Pages and a real browser proves a public query returns visible official citations while the old Cloud Run gateway may remain unavailable.

## Completion definition

The feature is complete when the public site is continuously usable for the approved read-only municipal corpus without requiring Cloud SQL to be running, the exact deployed SHA passes online browser verification, and the Graph Harness records a PASS gate plus completion checkpoint.
