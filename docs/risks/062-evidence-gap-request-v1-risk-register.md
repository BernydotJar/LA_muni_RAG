# Risk register — Feature 062

| ID | Risk | Severity | State | Control/evidence | Remaining action |
|---|---|---:|---|---|---|
| EGR-001 | Caller uses intake to declare a source official/applicable | high | mitigated in provider | closed schema, `requester_supplied_unverified`, imperative authority refusal, response has no authority fields, hard eval | repeat in external consumer and future resolution API |
| EGR-002 | Cross-tenant gap or replay disclosure | critical | mitigated locally | auth tenant binding, FORCE RLS, composite FKs, non-owner SQL/HTTP gates | staging/production topology verification |
| EGR-003 | Stored replay is schema-valid but semantically altered | high | mitigated locally | SHA-256 plus canonical response reconstruction and adversarial regression | monitor DB privilege drift |
| EGR-004 | Aggregate or request text leaks through audit | high | mitigated locally | allowlisted audit model and leak regression | centralized logging/trace review |
| EGR-005 | Documentary intake contains personal/confidential data | high | open governance | bounded fields and no ordinary audit copy | approve purpose, retention, deletion, notices and legal hold |
| EGR-006 | `open` is misrepresented as queued/resolved research | high | mitigated locally | contract limitations and no retrieval/compiler invocation | UI/consumer wording and operational queue design |
| EGR-007 | External OS consumer loses IDs or boundary limitations | high | open external | provider contract/eval only | cross-repository consumer contract tests |
| EGR-008 | Feature is treated as deployed because local gates pass | high | open release | docs distinguish local/published/merged/deployed | remote CI, PR, human release and staging evidence |
