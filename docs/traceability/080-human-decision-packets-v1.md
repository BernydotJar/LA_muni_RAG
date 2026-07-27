# Feature 080 traceability

| Requirement | Implementation | Verification |
|---|---|---|
| Four distinct human-gated topics | machine-readable packet index | validator and named EVAL |
| Preserve current factual blockers | `current_state` in index | validator exact-value assertions |
| No implicit selection/authorization | null selected option, empty actions, pending status | validator and EVAL |
| IdP decision criteria and prohibitions | `080-productive-idp-decision.md` | heading/content EVAL |
| Corpus rights/sensitivity/governance | `080-real-corpus-decision.md` | heading/content EVAL |
| Cloud SQL restart/apply/destroy separation | `080-cloud-sql-lifecycle-decision.md` | exact-action EVAL |
| Production prerequisite/release separation | `080-production-controls-decision.md` | readiness EVAL |
| Separate durable decision receipt | JSON Schema | schema shape EVAL |
| Authority roles and bounded scope | receipt required properties | schema EVAL |
| Common secret-pattern rejection | validator patterns | validator fixture/source EVAL |
| No action by packet alone | required document statement | validator |
| CI/repository gate | package scripts and backend CI | named EVAL |
| No production-readiness claim | index, packets, spec and program records | named EVAL |

## Executable evidence

- `npm run decision-packets:validate`
- `npm run eval:human-decision-packets`

The validator proves structure, pending state and internal consistency. It does not authenticate a decision authority, approve an action or inspect a live cloud/provider/source environment.
