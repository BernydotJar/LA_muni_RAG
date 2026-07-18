# Feature 052 — Local Case Portfolio Dashboard

## Objective

Aggregate browser-local Procedure Case Workspace records into a read-only operational portfolio.

## Scope

- Read only LocalStorage keys prefixed with `la-muni-rag:procedure-case:`.
- Accept only `schemaVersion: 1` records that satisfy the bounded workspace contract.
- Cap processing at 200 cases, 100 steps per case, 200 documents per step, and 300 audit events per case.
- Show operational counts for total, active, blocked, ready for review, and completed operationally.
- Show document-state counts for missing, requested, received, and reviewed operationally.
- Support text, procedure type, status, blocker, and recent-activity filters.
- Support deterministic sorting by updated time, title, and progress.
- Render case cards with title, procedure type, jurisdiction, progress, blocker count, missing documents, user-entered assignees, and last activity.
- Support a focused case view using `?case=<bounded-local-key-suffix>`.
- Export a consolidated portfolio JSON snapshot with `schemaVersion: 1`.
- Add a link from the Procedure Case Workspace panel to the portfolio.

## Safety boundary

- Portfolio metrics are operational signals only.
- Progress is not proof of legal compliance, budget availability, procurement approval, Concejo approval, COCODE approval, reception, liquidation, payment, or project closure.
- Document-state counts do not prove authenticity or legal sufficiency.
- User-entered assignees are not extracted authorities.
- No network calls, analytics, server persistence, document upload, or backend mutations.
- Malformed and unsupported LocalStorage records are ignored.
- Dynamic values are escaped before rendering.

## Out of scope

- Server-side portfolio storage.
- Multi-user collaboration.
- Institutional audit trail.
- Legal case status inference.
- Importing or mutating workspaces from the dashboard.
- Migrations, corpus writes, deployment, merge, or War Room changes.
