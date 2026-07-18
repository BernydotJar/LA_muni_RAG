# Feature 052R — Post-merge reconciliation

## Purpose

This increment reconciles the merged Feature 052 branch without changing product semantics.
It restores reviewable source files and adds an integrity gate so a compressed or truncated
artifact cannot satisfy a superficial string-matching test again.

## Changes

- Restored a complete, multi-line `public/procedure-case-portfolio.html` shell.
- Restored a readable `public/procedure-source-attribution.js` renderer while preserving the
  explicit `Abrir fuente oficial` label and bounded HTTP(S) links.
- Preserved the complete `src/procedure/types.ts` contract already present on the reconciled base.
- Changed `domain:evaluate` to use the official Node `tsx` loader rather than the IPC-dependent
  executable wrapper.
- Added a deterministic integrity test for line count, required closing tags, source labels,
  contract exports, and the evaluation command.

## Safety and scope

- No merge or deployment.
- No corpus, database, migration, or production-data write.
- No War Room file change.
- No semantic change to workflow authority classification.
- Operational portfolio state remains distinct from legal or institutional approval.

## Acceptance evidence

Focused validation completed in an isolated reconstruction:

1. portfolio HTML is complete and multi-line;
2. source attribution remains safe and explicit;
3. the procedure type contract remains complete;
4. `domain:evaluate` uses `node --import tsx`;
5. static integrity checks passed 7/7;
6. the emitted integrity test passed 4/4.

Full repository typecheck, build, domain evaluation, test suite, Pages build, Pages verification,
and diff checks remain required on a complete checkout before human approval. The execution
environment used for this reconciliation could not resolve `github.com` for a clone and did not
have GitHub CLI installed, so those gates are intentionally not represented as passing.
