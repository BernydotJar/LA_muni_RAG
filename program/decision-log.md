# Program Decision Log

## 2026-07-21 — Remote refs override false-negative push responses

Decision: after any connector push error, inspect the exact remote ref before retrying. The connector reported an ownership/Docker failure while `feature/workflow-lifecycle-v1` nevertheless advanced to `f12ee17`; therefore the remote SHA is authoritative and blind retries are prohibited.


## 2026-07-21 — Publication is proven only by the exact remote ref

Decision: treat `feature/workflow-lifecycle-v1` as pushed because `git ls-remote` returns exact commit `c6e110c`. Do not infer PR creation, merge, or CI from branch publication; `main` remains `4950ba3`.


## 2026-07-21 — Repository-persistent execution policy is authoritative

Decision: `AGENTS.md` defines the mandatory startup audit, preservation rules, authorized feature-branch Git actions, and human-gated operations for every execution session. `RTK.md` remains referenced for repository command-output discipline.

Reason: session continuity must be enforced from the checkout rather than relying on conversational memory or stale control-plane metadata.

## 2026-07-21 — Governed workflow lifecycle is a separate authoritative slice

Decision: persist procedure/workflow lifecycle in LA Muni RAG and expose action-specific v1 routes. Every version enters as `draft`; review, approval, supersession, and archival remain server-owned human governance actions.

Evidence: `d842b4e`, `c6e110c`, migrations 009–010, strict contracts, HTTP tests, non-owner SQL gate, and compiled PostgreSQL smoke.

Rejected: caller-selected approved status, frontend-only authorization, generic unrestricted workflow patching, and shared procedure tables with adjacent products.

## 2026-07-21 — Supersession is an atomic replacement approval

Decision: a supersession request must identify an `in_review`, recommended, same-procedure replacement. One transaction locks the records, supersedes the current approved version, appends replacement approval evidence, approves the replacement, and leaves exactly one approved row.

Reason: requiring the replacement to be approved beforehand conflicts with the one-approved-version invariant and creates an unavailable intermediate state.

## 2026-07-21 — Corrupt replay cleanup commits before error emission

Decision: response replay is accepted only after schema, request, tenant, and audit identity validation. Invalid replay state is deleted and audited in a committed transaction; the generic error is emitted afterward.

Reason: throwing inside the cleanup transaction would restore the corrupt row through rollback.

## 2026-07-21 — Production-shaped database verification may use an equivalent disposable runtime

Decision: when Docker-in-Docker cannot register the pinned service image, use PostgreSQL 15.18 plus pgvector 0.8.5 built from the verified official v0.8.5 commit for local evidence. Keep remote CI pinned to PostgreSQL 16/pgvector 0.8.5.

Reason: the acceptance criteria are database behavior, RLS, transactions, contracts, and compiled adapters—not dependence on a broken nested Docker storage driver. Version differences and remote CI remain explicit limitations.

## 2026-07-21 — Fail-closed evidence abstention is a passing outcome

Decision: a citable source without a step-level evidence link must produce explicit `missing_evidence`, not a fabricated claim. Positive fixtures must include a genuinely matching evidence phrase; tests may not relax claim promotion rules.

## 2026-07-21 — Publication remains connector-owned

Decision: do not extract credentials, invoke raw `git push`, force-push, or escalate privileges after the dedicated connector fails before Git execution. Preserve the exact commit graph and retry only through an authorized, repaired publication path.

## 2026-07-21T17:30:46Z — Exact artifact acceptance is a database invariant

Object acceptance must prove current clean scan, exact SHA-256, MIME and generation with a future window no longer than seven days. Accepted identity and scan evidence are immutable; corrupt history stops migration instead of being silently repaired.

## 2026-07-21T17:30:46Z — Finalization uses a narrow privileged lock boundary

The runtime receives no artifact-table UPDATE. A fixed-search-path, tenant-bound, PUBLIC-revoked SECURITY DEFINER function returns only a boolean while locking exact rows until transaction completion.

## 2026-07-21T17:30:46Z — Connector errors require remote-SHA reconciliation

A Docker/NAT connector error is not a publication result. `git ls-remote` is authoritative; `feature/artifact-vector-runtime-hardening-v1` is published at `f539db3aa910dbf57328602daf19fec2ed3e9677`.

## 2026-07-21T17:31:36Z — Remote CI accepted Feature 060

Backend CI run `29852618726` and check `88709014203` completed successfully on exact SHA `f539db3aa910dbf57328602daf19fec2ed3e9677`. This proves CI execution, not merge or deployment.
