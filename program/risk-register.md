# Program Risk Register

Updated: 2026-07-21

| ID | Risk | Severity | State | Evidence/control | Next action |
|---|---|---:|---|---|---|
| PRG-RISK-001 | Stale Cloud Sandbox metadata reports `error` for a fully usable workspace | medium | open external | container running; exec, filesystem, Git, tests, DB gates all succeed | deploy the control-plane readiness reconciliation fix; do not use persisted state alone as repository truth |
| PRG-RISK-002 | Dedicated publication helper previously failed before Git | high | resolved for functional head | remote `feature/workflow-lifecycle-v1` now equals `c6e110c`; main remains `4950ba3` | verify each subsequent checkpoint SHA and remote CI; do not infer PR or merge state |
| PRG-RISK-003 | Minimum Antigua/Mixco corpus is incomplete and zero documents are credited as ingested | critical | open | source inventory is structurally valid but only 4 verified, 1 acquired, 4 missing, 0 ingested | acquire, accept, scan, ingest, retrieve, and evaluate minimum corpus without inventing missing sources |
| PRG-RISK-004 | Approved workflow status may be misunderstood as legal applicability | high | mitigated, global governance open | response limitations, lifecycle docs, human separation, no automatic promotion | add UI warnings, applicability/conflict review, training, and consumer contract enforcement |
| PRG-RISK-005 | External consumers may lose IDs, expiry, revocation, or boundary semantics | high | open | provider contracts and local tests pass; cross-repository consumers not executed | run OS Electoral and Content Agency consumer contract suites on published versioned artifacts |
| PRG-RISK-006 | Procedure cases remain browser-local rather than an authoritative tenant-scoped system | high | open | LocalStorage workspace exists; server API/DB absent | implement procedure-case schema, repository, API, audit, authorization, and migrations |
| PRG-RISK-007 | Platform operations are not production-shaped | critical | open | local CI/runbooks exist; Terraform, secrets topology, observability, restore/load/HA evidence incomplete | select platform architecture, implement IaC and monitoring, execute backup/restore and load/HA drills |
| PRG-RISK-008 | Semantic documentary conflicts and version applicability remain unresolved | critical | open | conflict visibility eval passes; no persistent resolution/applicability service | implement conflict review records, version applicability decisions, and human resolution workflow |
| PRG-RISK-009 | Nested Docker limitations hide SQL defects when mocks are used alone | high | mitigated | ClaimPack syntax and lifecycle audit drift were found by real PostgreSQL; fresh SQL/smoke gates now pass | retain non-owner SQL and compiled HTTP smokes as required CI gates |
| PRG-RISK-010 | Workflow UI and accessibility are absent | high | open | API is implemented; no authenticated review/approval UI or WCAG evidence | implement role-aware UI and browser/a11y gates |

No critical or high finding remains unresolved inside the governed workflow lifecycle API slice itself. This statement does not apply to the global production-readiness program.
