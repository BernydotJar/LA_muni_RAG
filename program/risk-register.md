# Program Risk Register

Updated: 2026-07-21T17:30:46Z

| ID | Risk | Severity | State | Evidence/control | Next action |
|---|---|---:|---|---|---|
| PRG-RISK-001 | Stale workspace state reports `error` for usable runtime | medium | open external | container/exec/Git/DB/tests/push work | capability probes; separate control-plane fix |
| PRG-RISK-002 | Connector reports failure after remote mutation | high | mitigated tooling | exact remote `f539db3aa910dbf57328602daf19fec2ed3e9677` verified | verify SHA before every retry |
| PRG-RISK-003 | Minimum corpus incomplete; zero documents credited ingested | critical | open | inventory 17, verified 4, acquired 1, ingested 0 | acquire/scan/ingest/retrieve/evaluate official corpus |
| PRG-RISK-004 | Production scanner/storage/dispatcher absent | critical | open | Feature 060 proves boundaries, not adapters | deploy immutable storage, quarantine IAM, scanner and worker |
| PRG-RISK-005 | Real-corpus vector quality/load unproved | high | open | tenant atomic synthetic smoke passes | measure recall, citation fidelity, plans/timeouts/load |
| PRG-RISK-006 | Procedure cases browser-local | high | open | server API/DB absent | implement case lifecycle system of record |
| PRG-RISK-007 | Approved workflow confused with legal applicability | high | mitigated/global open | human separation and limitations | persistent applicability review and UI/consumer warnings |
| PRG-RISK-008 | External consumers may lose provenance/revocation | high | open | provider contracts only | cross-repository consumer suites |
| PRG-RISK-009 | Platform operations not production-shaped | critical | open | runbooks/local CI only | Terraform, secrets, telemetry, restore/rollback/load/HA/staging |
| PRG-RISK-010 | Workflow/document UI and accessibility absent | high | open | backend slices only | role-aware UI and WCAG browser gates |
| PRG-RISK-011 | Required dedicated eval families missing | high | open | 12 pass; 7 absent | SOURCE/MISSING/RBAC/INGEST/CASE/ACCESSIBILITY/RESTORE |

Feature 060 has zero open critical/high findings. This does not apply globally.
