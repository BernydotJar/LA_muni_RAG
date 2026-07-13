# Workflow Template Editor Foundation

Feature `047-workflow-template-editor-foundation` introduces a controlled JSON authoring format for procedural workflow templates.

## Boundary

This feature validates and previews reviewable JSON. It does not publish templates automatically, mutate the active domain pack, write to PostgreSQL, execute imported code, or convert feedback into authoritative procedure.

The runtime continues to use `DomainPack.workflowTemplates`. The authoring contract is intentionally separate so a future approval step can compare, review, and promote validated JSON into source-controlled domain-pack configuration.

## Contract

A collection has this shape:

```json
{
  "schemaVersion": 1,
  "domainPackId": "municipal-antigua",
  "templates": []
}
```

Each template defines:

- owning `domainPackId`;
- safe `workflowId`;
- existing `workflowType`;
- title, description, summary, and validation warning;
- governance-rule ids;
- evidence requirement;
- authoritative flag;
- ordered steps.

Each step defines:

- safe stable id;
- one-based contiguous order;
- label and action;
- required and output documents;
- allowed source-authority ids;
- governance-rule ids;
- evidence patterns;
- optional human-validation flag and notes.

## Validation

The validator rejects:

- unsafe or traversal-like ids;
- wrong domain ownership;
- unknown workflow types;
- duplicate workflow or step ids;
- duplicate or non-contiguous step order;
- empty labels or actions;
- unknown source authorities;
- unknown governance rules;
- authoritative templates that do not require evidence;
- required-evidence steps without evidence patterns or allowed source authorities.

Validation is deterministic and does not use an LLM, database, network, dynamic import, `eval`, or executable configuration.

## Validate a file

```bash
npm run workflow:validate -- examples/workflow-templates/municipal-antigua.public-works.json
```

The CLI accepts exactly one repository-relative `.json` path, reads it, validates it against the registered domain pack, and prints a stable summary. It performs no writes.

## Example

See:

```text
examples/workflow-templates/municipal-antigua.public-works.json
```

The example is reviewable authoring material. It is not automatically active and does not replace the current `municipal-antigua` runtime templates.

## Conversion utility

`convertDomainWorkflowTemplate()` maps an existing runtime `DomainWorkflowTemplate` into the editable contract using deterministic step ids and one-based order. This supports compatibility checks and future migration tooling without changing runtime behavior.

## Review and publication model

A future publication flow should remain explicit:

1. author or edit JSON;
2. validate locally;
3. review the diff;
4. obtain domain-owner approval;
5. convert or copy into the source-controlled domain pack;
6. run domain evaluation and the full test suite;
7. merge through normal code review.

No automated promotion is provided by this feature.
