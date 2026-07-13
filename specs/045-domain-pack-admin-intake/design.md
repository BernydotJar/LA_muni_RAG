# Design — Domain Pack Admin Intake

## Page

`/domain-intake.html` is a static local tool. It reads the active domain pack from `/api/domain-pack` and renders an intake form for:

- source file path;
- manifest path;
- document key;
- document version;
- title;
- source format;
- source authority class;
- document type;
- jurisdiction;
- organization;
- confidentiality;
- tags.

## Output

The page generates:

- a `DomainDocumentMetadata` JSON preview;
- a shell command for `src/cli/backfillCorpus.ts`.

## Safety Boundary

The page does not execute commands. It does not upload files, write to the backend, store data, or call any mutation endpoint.

## Pages

The page includes `pages-demo-api.js` so `/api/domain-pack` works in demo and proxy mode. `build-pages` copies the page, and `verify-pages-artifact` requires it.
