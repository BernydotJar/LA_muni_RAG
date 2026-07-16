# Design — Workflow Template Editor Foundation

## Architecture

```text
Reviewable JSON template
  ↓
workflow-template validation CLI
  ↓
strict parser + domain ownership validation
  ↓
validated editable template
  ↓
manual review / future publication step
```

The runtime continues to use the existing `DomainPack.workflowTemplates` collection. Feature 047 adds a separate authoring contract and deterministic conversion utility so existing packs remain compatible.

## Modules

```text
src/workflowTemplates/types.ts
src/workflowTemplates/validation.ts
src/workflowTemplates/conversion.ts
src/workflowTemplates/index.ts
src/cli/validateWorkflowTemplate.ts
```

## Editable Contract

The contract contains:

- `domainPackId`;
- `workflowId`;
- `workflowType`;
- title, description, summary, and validation warning;
- explicit governance-rule ids;
- explicit evidence requirement;
- ordered steps with stable ids;
- required and output documents;
- source-authority ids;
- evidence patterns;
- optional human-validation flags.

## Validation

Validation is deterministic and receives an already validated `DomainPack` from the registry.

It rejects:

- unsafe ids;
- wrong domain ownership;
- unknown workflow type;
- duplicate workflow or step ids;
- duplicate/non-contiguous step order;
- empty strings or arrays where evidence is required;
- unknown authority or governance ids;
- authoritative templates without explicit evidence requirements.

## CLI Boundary

The CLI:

- accepts a single repository-relative `.json` path;
- rejects absolute paths and traversal;
- resolves the file under `process.cwd()`;
- parses JSON only;
- validates against the registered domain pack;
- prints a stable summary;
- performs no writes.

## Compatibility

A converter maps existing `DomainWorkflowTemplate` definitions to the editable format using deterministic kebab-case step ids and one-based order. Compatibility tests compare the converted municipal template with current runtime composition expectations.

## Security

- no evaluation or dynamic import;
- no arbitrary writes;
- no network calls;
- no automatic activation;
- no feedback-to-template promotion;
- no database changes.
