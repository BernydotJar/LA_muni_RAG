# Feature 037A — Frontend Widget Contract Regression Fix

## Mode

MVP

## Objective

Stabilize the existing frontend/widget regression suite after Feature 036 without changing Procedure Workflow Advisor logic.

The full `npm run test` suite currently fails on legacy frontend/widget contract assertions, while `036` typecheck/build and the procedure workflow tests pass. This feature updates brittle frontend test contracts so they validate the current compact/minified static assets without requiring unrelated product changes.

## Scope

- Frontend/widget contract tests only.
- Keep `/api/procedure` and all `src/procedure/*` files unchanged.
- Do not touch generated `dist-pages/` artifacts.
- Preserve current widget API contract: `/api/chat`, `message`, `mode: this.searchMode`, `limit: 5`.
- Preserve mode controls: keyword and phrase.
- Preserve civic hero asset contract.
- Preserve Glass Wall approved endpoint allowlist contract.
- Preserve honest source-link behavior.

## Non-goals

- No UI redesign.
- No Procedure Workflow UI cards yet.
- No changes to retrieval, procedure composition, or backend API behavior.
- No build artifact cleanup for untracked `dist-pages/`.

## Acceptance Criteria

- Tests tolerate compact frontend JavaScript syntax such as `this.searchMode="keyword"` and formatted syntax such as `this.searchMode = "keyword"`.
- Civic hero motion assertions accept the current SVG animation names while still requiring orbital/ring motion.
- Glass Wall allowlist tests continue to require `approvedEndpointPaths`, `/health`, `/api/evidence`, `/api/answer`, and a clear blocked-endpoint message.
- `npm run test` should be green locally after this feature, assuming no unrelated local/untracked artifact issues.
