# Feature 080 — Human-gated production decision packets v1

Status: implemented as pending-decision artifacts; no gated action authorized

## Goal

Convert four unresolved human-gated prerequisites into versioned, machine-readable and reviewable decision packets without selecting a provider, acquiring real data, mutating cloud resources, approving a merge or authorizing production.

## Required packets

1. `HDP-IDP-001` — productive human identity provider and operating model.
2. `HDP-CORPUS-001` — real municipal corpus rights, scope and governance.
3. `HDP-CLOUDSQL-001` — Cloud SQL lifecycle, cost and data disposition.
4. `HDP-PRODUCTION-001` — production controls, readiness program and release authority.

## Functional requirements

1. A machine-readable index records current facts, global prohibited actions and the four pending packets.
2. Every packet has `selected_option: null`, an empty `authorized_actions` array and `decision_status: pending_human_decision`.
3. The index preserves known facts: zero real documents/evaluation, zero of twelve productive authenticated journeys, no managed staging receipt, Cloud SQL stopped with activation policy never, no productive IdP/exporter, no protected merge and no production release.
4. Each document includes: decision required, current evidence, options, evaluation criteria, preconditions, prohibited actions, post-approval evidence and decision receipt requirements.
5. No packet names a selected product, source, cloud action or release date.
6. No packet itself authorizes execution. Every document states that no action is authorized by the packet alone.
7. A JSON Schema defines a separate decision receipt with packet ID, decision outcome, authority roles, durable record reference, explicitly approved actions, bounded scope, constraints and evidence references.
8. Approval receipts prohibit extra fields and distinguish approved, rejected and deferred outcomes.
9. A deterministic validator checks exact packet IDs/topics, pending state, empty authorization, current facts, required document headings, prohibited actions and receipt schema shape.
10. The validator scans packet documents for common private-key, token and credential patterns.
11. Named EVAL validates fail-closed semantics, no implicit selection/authorization, action-specific prerequisites and program/CI wiring.
12. Program records must keep production readiness false and all gated actions open until a conforming human receipt is added and independently reviewed.

## Acceptance criteria

- `npm run decision-packets:validate` passes.
- `EVAL-HUMAN-DECISION-PACKETS-001` passes.
- JSON/schema/documents parse and cross-reference correctly.
- The current-state facts match the versioned program baseline.
- No selected option, authorized action, secret, credential, productive endpoint or fabricated approval exists.
- Typecheck, build, full regression, structured validation, dependency audit, secret/PII scan and diff checks pass.
- No cloud, identity, corpus, merge, billing or production action is executed.

## Explicit limitations

- These packets are decision preparation, not approvals.
- The receipt schema does not prove the signer/authority; the durable human decision system remains external.
- A conforming receipt still requires independent scope, security, privacy/legal, operations and release review before execution.
- Productive IdP, corpus, Cloud SQL lifecycle changes, managed staging and production remain absent.
- Production readiness is not claimed.
