# Program Risk Register

Updated: 2026-07-21T19:36:34Z

| ID | Risk | Severity | State | Evidence/control | Next action |
|---|---|---:|---|---|---|
| PRG-RISK-001 | Stale workspace state reports `error` for usable runtime | medium | open external | container/exec/Git/DB/tests/push work | capability probes; separate control-plane fix |
| PRG-RISK-002 | Connector prose may disagree with remote mutation | high | mitigated tooling | exact remote `66b41b943242d9c4317d35f125de1cd617ebb6e4` and CI API verified | verify remote SHA before every retry |
| PRG-RISK-003 | Minimum corpus incomplete; zero documents credited ingested | critical | open | inventory 17, verified 4, acquired 1, ingested 0 | acquire/scan/ingest/retrieve/evaluate official corpus |
| PRG-RISK-004 | Production scanner/storage/dispatcher absent | critical | open | artifact/lease/vector boundaries pass, not deployed adapters | deploy immutable storage, quarantine IAM, scanner and worker |
| PRG-RISK-005 | Real-corpus vector quality/load unproved | high | open | tenant atomic synthetic smoke passes | measure recall, citation fidelity, plans/timeouts/load |
| PRG-RISK-006 | Procedure cases browser-local | high | open | server API/DB absent | implement case lifecycle system of record |
| PRG-RISK-007 | Approved workflow confused with legal applicability | high | mitigated/global open | human separation and limitations | applicability review and UI/consumer warnings |
| PRG-RISK-008 | External consumers may lose provenance/revocation/limitations | high | open | providers only | cross-repository consumer suites |
| PRG-RISK-009 | Platform operations not production-shaped | critical | open | runbooks/local/remote CI only | Terraform, secrets, telemetry, restore/rollback/load/HA/staging |
| PRG-RISK-010 | Authenticated workflow/document UI and accessibility absent | high | open | public/demo frontend only | choose browser auth/BFF; role-aware UI and WCAG browser gates |
| PRG-RISK-011 | Required dedicated eval families missing | high | open | 14 pass; 7 absent | SOURCE/MISSING/RBAC/INGEST/CASE/ACCESSIBILITY/RESTORE |
| PRG-RISK-012 | Immutable EvidenceGap text lacks approved retention/deletion/legal-hold policy | high | open governance | bounded fields, audit minimization, explicit unverified label | Privacy/Legal decision plus append-only resolution/retention design |
| PRG-RISK-013 | EvidenceGap `open` may be mistaken for queued or resolved research | high | mitigated/provider open operations | response limitations; no compiler/retrieval; eval/smoke | UI/consumer wording and actual research lifecycle |
| PRG-RISK-014 | Browser could misuse integration Bearer credentials as SaaS login | critical | prohibited design | no credential added to public frontend; current UI remains demo/read-only | approve IdP/session/BFF architecture before authenticated SaaS shell |

Feature 062 has zero open critical/high **code** findings. External consumer,
privacy, operations and global production risks remain open.
