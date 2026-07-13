# Feature 047 — Workflow Template Editor Foundation

## Mode

MVP

## Objective

Add a controlled, domain-neutral, file/JSON-based foundation for authoring and validating workflow templates without changing the current runtime behavior of existing domain packs.

## Required Capabilities

1. Define a typed editable workflow-template contract.
2. Validate:
   - domain-pack ownership;
   - workflow id and workflow type;
   - title, description, and validation warning;
   - step ids and step order;
   - labels and actions;
   - required and output documents;
   - allowed source-authority classes;
   - governance rules;
   - evidence requirements;
   - optional human-validation checkpoints.
3. Reject:
   - unsafe ids;
   - unknown domain packs;
   - unknown workflow types;
   - duplicate workflow ids in a collection;
   - duplicate step ids;
   - duplicate or non-contiguous step order;
   - empty steps, labels, or actions;
   - unknown source-authority classes;
   - unknown governance rules;
   - evidence-backed templates without explicit evidence requirements.
4. Add a deterministic conversion utility from existing `DomainWorkflowTemplate` objects to the editable contract.
5. Add a safe read-only CLI that validates repository-local JSON files.
6. Add a reviewable `municipal-antigua` JSON example.
7. Preserve current municipal classification and workflow composition behavior.

## Security Requirements

- Imported content is parsed only as JSON.
- No `eval`, dynamic import, JavaScript expressions, or executable configuration.
- CLI rejects absolute paths, traversal segments, and non-JSON files.
- CLI never writes or publishes templates.
- Feedback is never converted automatically into an authoritative template.
- Validation failures use stable deterministic error messages.

## Runtime Boundary

Feature 047 introduces an authoring and validation foundation only.

It does not:

- replace domain-pack runtime templates;
- publish templates automatically;
- add a visual editor;
- change public APIs;
- change database schema;
- modify `dist-pages/`.

## Acceptance Criteria

- Existing `municipal-antigua` procedure behavior remains compatible.
- The municipal example passes the validator.
- Invalid ownership, ids, steps, authority references, governance references, and evidence claims fail validation.
- The full repository verification gate passes before the feature is marked `done`.
