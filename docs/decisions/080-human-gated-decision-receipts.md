# ADR 080 — Explicit human decision receipts for gated actions

Date: 2026-07-27
Status: accepted for decision preparation; no gated action approved

## Context

LA Muni RAG has several prerequisites that cannot be resolved safely by autonomous implementation: productive identity-provider selection, rights-cleared real corpus acquisition, Cloud SQL lifecycle/cost/data disposition, and production controls/release authority. Narrative blockers alone can drift, and informal approval can be misinterpreted or applied beyond its intended scope.

## Decision

Represent each gated topic as a versioned pending-decision packet and require a separate machine-readable human decision receipt before execution.

- Packets contain options, evidence, preconditions, prohibited actions and required post-approval evidence.
- Pending packets always have no selected option and no authorized actions.
- A receipt identifies the packet, approved/rejected/deferred outcome, authority roles, durable external record, explicitly approved actions, bounded environment/scope, constraints and evidence references.
- Receipt validation prohibits undeclared fields and distinguishes decision preparation from execution authorization.
- The repository does not infer approval from conversation, meeting notes, draft PR state, local test adapters, successful CI or elapsed time.
- Every execution still requires an independent scope/safety check against the receipt and current remote/resource state.

## Alternatives rejected

### Continue with prose-only blockers

Rejected. Prose is useful context but does not provide a stable packet ID, exact authorized-action list, bounded scope or validation contract.

### Treat a chat instruction as sufficient approval

Rejected. It can be ambiguous, lack authority/scope, and is difficult to audit or reverse. A durable decision record and receipt are required.

### Preselect products or cloud actions to accelerate approval

Rejected. Product selection, billing, credentials, infrastructure mutation and data acquisition are human-gated and may create lock-in or unauthorized cost/risk.

### Combine all decisions into one global go-live approval

Rejected. Identity, corpus, database lifecycle and release controls have different authorities, evidence, rollback and timing. Approval of one must not imply another.

## Consequences

Positive:

- prevents implicit or overbroad authorization;
- preserves current facts and prohibited actions in machine-readable form;
- makes decision ownership, scope and evidence explicit;
- supports rejected/deferred outcomes without pressure to execute;
- separates approval receipts from operational execution receipts.

Residual limitations:

- the repository cannot authenticate the human decision maker;
- external governance must provide the durable authoritative record;
- approved receipts can become stale and require expiry/review;
- execution remains a separate, independently verified action;
- no productive prerequisite is satisfied by this ADR or packet bundle.
