# Feature 080 decision-packet risk review

Date: 2026-07-27
Scope: pending human decisions for IdP, corpus, Cloud SQL and production controls

| Risk | Control implemented | Verification | Residual risk / next gate |
|---|---|---|---|
| Packet is mistaken for approval | pending status, null selection, empty authorized actions, explicit no-action statement | deterministic validator and named EVAL | human reviewers/operators must check receipt before execution |
| Approval scope expands by implication | receipt requires explicit approved actions, environment/scope and constraints | strict receipt schema | operational command review must match receipt exactly |
| One decision implies another | four separate packet IDs and authorities | index/EVAL | cross-packet prerequisite review remains human |
| Product/vendor is preselected | no selected option; provider-neutral criteria | validator/EVAL | human procurement/security analysis remains external |
| Real data acquired without rights | corpus packet prohibits acquisition/ingestion until receipt | packet/EVAL | source-owner/legal evidence must be verified independently |
| Stopped Cloud SQL is restarted or destroyed | exact current state and separate prohibited restart/apply/destroy actions | index/EVAL | cloud control plane remains external and requires live-state recheck |
| Billing or irreversible deletion is implied | billing, destroy and data/backup deletion explicitly gated | packet/EVAL | receipt authority and cost/data-owner identity must be verified |
| Local tests become production evidence | packets preserve 0/12, no managed receipt and no productive SLO | validator/EVAL | reviewers may still overvalue synthetic/local evidence |
| Fabricated or stale receipt | durable external record, authority roles, evidence and optional expiry required | schema/EVAL | repository cannot authenticate signer; external governance required |
| Secret enters packet/receipt | packet validator scans common token/private-key patterns; receipts reference secret systems, not values | validator and repository secret scan | broader DLP and human review remain necessary |
| Receipt authorizes unsafe adjacent action | `approved_actions` must be explicit and execution is separately reviewed | schema/ADR | operator error or compromised authority remains possible |
| Production readiness is claimed prematurely | global false readiness field and production packet prerequisites | validator/program gate | final release still requires managed evidence and independent approval |
| OS Electoral/Content Agency scope is absorbed | packets keep LA Muni RAG provider-side and prohibit capability substitution | corpus/production packet review | external consumers must independently implement their owned capabilities |
| Remote branch/CI omission is ignored | production packet records publication and exact-SHA CI blocker | named EVAL/program records | audited push must be enabled by platform operator |

## Review conclusion

The packet bundle makes human gates clearer and more auditable without authorizing any action. Its strongest limitation is authority authenticity: the repository can validate receipt structure and scope, but only external governance can prove that the correct humans made the decision.
