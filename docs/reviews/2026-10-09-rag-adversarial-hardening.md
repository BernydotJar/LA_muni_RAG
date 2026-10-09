# 2026-10-09 — Adversarial review and public RAG boundary hardening

## Scope and provenance
Repository: `BernydotJar/LA_muni_RAG`. Working branch: `feature/glass-wall-directional-flow-v1`. This change affects the public read-only GitHub Pages/query presentation and runtime safety; it does **not** expand the legal corpus, enable productive identity/tenancy, validate legal currency or deploy infrastructure. The original untracked `docs/architecture/agentic-engineering-architecture-audit.md` was preserved and excluded.

Review method: reproducible red tests against the actual JavaScript runtime, independent test processes and Playwright browser flows; manually separated producer, critic and verification roles. IBM Granite `ibm/granite3.3:2b` was available in local Ollama but **did not complete inference**. Two invocations ended with `llama-server process has terminated: signal: killed` under constrained memory/swap. No model-produced finding, Granite endorsement, penetration test or external human review is claimed.

## Findings, adversarial reproductions and repairs

| Finding | Severity | Proof before fix | Repair | Validation |
| --- | --- | --- | --- | --- |
| RAG-ADV-01: substring matches falsely inflate cited results | High / evidence quality | `agua` matched pages containing only `aguacate` (both keyword and phrase). | Unicode word-boundary-aware lexical counts, aligned relevance/title/excerpt scoring. | Deterministic false-positive and positive-control tests. |
| RAG-ADV-02: public query contract coerces malformed input | Medium / integrity | Object-valued `message`, string `limit` and oversized queries were accepted. | Validate the message's string type and length; accept numeric integer limits only. | Explicit malformed-input 400 tests. |
| RAG-ADV-03: public Pages bridge redirects unrelated cross-origin requests | High / request integrity | `https://unrelated.example.net/api/public/v1/query` matched the local route and was rewritten. | Route bridge matches the exact origin and approved path/method. | External-origin pass-through and legitimate local proxy regression. |
| RAG-ADV-04: untrusted source links are created as anchors too early | High / UX security | A citation URL was inserted into `href` before the periodic post-render guard could reject it; valid links initially lacked `rel` at creation. | Validate absolute HTTPS and no URL credentials before rendering in the widget, source attribution and training; create outbound link with `target=_blank` and `rel=noopener noreferrer`. Harden defense-in-depth guard. | Playwright malicious `javascript:`, HTTP, relative, URL-userinfo and good HTTPS samples, desktop and mobile. |
| RAG-ADV-05: duplicate submissions while first query pending | Medium / CX | Multiple requests could be started via Enter while the first remained in-flight. | Serialize widget requests, disable and restore submit during pending fetch, cap input at 800. Route widget through same-origin Pages bridge when configured. | Browser deferred-response test and native proxy/credential regression. |
| RAG-ADV-06: vulnerable direct transport dependency | High / dependency security | `undici@8.9.0` appears in npm audit at high severity. | Bump direct dependency to `undici@8.11.2` (same major), lock updated. | `npm audit --omit=dev --audit-level=high` exit 0 after update; focused TypeScript/build/tests passed. |

## Verification receipts (local)

- Pre-fix adversarial Node tests: 5 cases; 3 fail, 2 pass. Post-fix: 5/5 pass.
- Local full unit suite after the `undici` update: 1,102 tests; 1,100 passed, 0 failed, 2 environment skips. The same count also passed before the dependency change.
- Full public Playwright suite (explicit isolated port 4198): 42/42 passed across Chromium desktop/mobile. An initial Playwright-managed server startup timed out; rerun with a manually scoped server passed.
- TypeScript `npm run typecheck`: PASS. `npm run build`: PASS. Post-`undici` update rerun of both and 15 focused tests: PASS.
- `npm run graph-harness:verify`: PASS of pinned graph runtime integrity (160 historical events, 13 nodes). `npm run eval:glass-wall-flow`: 15/15 PASS.
- `node scripts/verify-pages-artifact.mjs`: PASS; no evidence of a new public deployment or current remote CI on the new head.
- `npm audit --omit=dev --audit-level=high`: exit 0 after upgrading `undici`; three **moderate** transitive advisories remain from `mammoth -> argparse -> sprintf-js`. No nonbreaking resolution offered by npm. **Do not use `npm audit fix --force` without targeted compatibility/security assessment.**
- No tenant credentials or secrets added. Public sample sources are not changed. Generated `dist-pages` artifacts are excluded from the targeted commit.

## Boundaries and pending gates

This local code quality pass is not proof of legal authority, source currency/applicability, productivity of cloud identity, completeness of corpus, or a production-ready enterprise rollout. A real Granite critic remains blocked by insufficient workstation memory. This release has **not** passed new-HEAD remote Backend CI or the public online Pages validation; preserve human gates for merge/deploy and productive legal decisions. An independent model critic can be rerun after memory pressure is resolved.

Repository changes are scoped to the existing feature branch. All claims about push/remote SHA are deliberately excluded until confirmed by separate audited Git push and remote-ref reconciliation.
