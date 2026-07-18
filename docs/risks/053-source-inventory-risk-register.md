# Feature 053 — Risk Register

| ID | Risk | Impact | Mitigation | Current status |
|---|---|---|---|---|
| R-053-01 | A portal URL is mistaken for an acquired document. | False ingestion claims. | Separate inventory and operational manifests; require artifact/hash evidence. | Controlled |
| R-053-02 | Mixco material is presented as Antigua procedure. | Incorrect municipal authority. | Comparative authority validation, mandatory limitation and adversarial tests. | Controlled |
| R-053-03 | National law is treated as proof of Antigua internal practice. | Unsupported procedural conclusions. | `hasAntiguaEvidence` now requires primary municipal authority. | Controlled |
| R-053-04 | Generic title keywords promote another municipality to primary. | Authority leakage. | Named external municipalities resolve to comparative authority first. | Controlled |
| R-053-05 | An acquired version is overwritten by a different hash. | Loss of provenance. | Detect duplicate source/version and conflicting hashes. | Controlled |
| R-053-06 | Inventory says ingested but operational manifest differs. | Inconsistent corpus state. | Reconcile document key, version, hash, indexed status and chunk count. | Controlled |
| R-053-07 | Official Antigua documents remain unavailable or stale. | Incomplete grounded workflows. | Preserve `missing_source`; require verification date and later acquisition plan. | Open |
| R-053-08 | Official portal URLs change. | Broken acquisition path. | Store verification timestamp; reverify before acquisition. | Open |
| R-053-09 | Domain metadata rejects declarative authority classes. | Ingestion failure. | Translate inventory classes to valid domain-pack IDs and test mapping. | Controlled |
| R-053-10 | Current inventory is interpreted as a completed corpus. | Misleading product claims. | Document and test acquired=0 and ingested=0. | Controlled |

## Release boundary

Feature 053 provides a source inventory foundation, not an authenticated document library and not a completed municipal corpus. Those capabilities remain future increments.
