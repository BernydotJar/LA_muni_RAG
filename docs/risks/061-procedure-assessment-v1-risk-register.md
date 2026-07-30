# Feature 061 risk register

| ID | Severity | State | Risk | Control/evidence | Remaining action |
|---|---:|---|---|---|---|
| 061-R1 | critical | resolved in slice | Caller IDs could fabricate completed requirements | completed list fixed empty; opaque-reference limitation; mapper/HTTP eval | Future case service must validate tenant document bindings |
| 061-R2 | high | resolved in slice | Requirement evidence could be confused with case completion | document status remains inferred-for-review or weaker | Preserve monotonicity in case APIs/UI |
| 061-R3 | high | resolved in slice | Stored assessment replay could bypass schema/tenant checks | output-specific replay validator and corrupt-replay regression | Retain PostgreSQL corrupt replay smoke |
| 061-R4 | high | mitigated/global open | Draft assessment mistaken for legal approval or feasibility | explicit limitations, draft version, blocked steps, no campaign fields | UI/consumer warnings and human applicability review |
| 061-R5 | high | open external | OS Electoral consumer may alter or drop provenance | provider contract/eval only | Run cross-repository consumer contract tests |
| 061-R6 | medium | mitigated | Assessment replay could become implicit storage for narrative case facts/constraints | response artifact empties narrative arrays and preserves only opaque references; regression checks markers absent | Re-review when implementing procedure cases and retention |
| 061-R7 | medium | open | Large workflows may generate many unknowns | dedupe, 1,000-char item bound, 256-item cap, 4 MiB replay DB check | Add load/response-size evaluation |
