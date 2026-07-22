# Feature 061 requirements traceability

| Requirement | Implementation | Verification | State |
|---|---|---|---|
| Third procedure-query output | explicit handler branch and assessment validator | API/OS eval, OpenAPI oneOf | verified local |
| Same scoped compilation | existing compiler/mapping options | compiler call count 1 | verified local |
| No caller-forged completion | `completed_requirements: []` and opaque-ref limitation | mapper eval | verified local |
| Requirement evidence below completion | missing document status preserved/downgraded | cited-evidence eval | verified local |
| Blocked steps/unknowns/next action | assessment mapper | no-evidence and HTTP eval | verified local |
| Exact replay | existing idempotency path | HTTP replay bytes equal | verified local |
| Corrupt replay fail-closed | assessment replay validator | marker non-leak and invalidation eval | verified local |
| Tenant/credential/audit provenance | shared handler + mapper | schema/API assertions | verified local |
| Narrative context minimization | assessment response emits empty facts/constraints and only opaque refs | marker non-persistence eval | verified local |
| Product boundary | closed schema and no foreign fields | OS eval | verified local |
| PostgreSQL compiled smoke | updated script | ProcedureQuery success/replay plus ClaimPack/lifecycle regression on PostgreSQL 15.18/pgvector 0.8.5 | verified local |
| Remote CI | Backend CI workflow | run 29855067232 / check 88717220160 on SHA 56b9866 | verified remote |
| OS consumer interoperability | external repository | consumer contract suite | pending |
