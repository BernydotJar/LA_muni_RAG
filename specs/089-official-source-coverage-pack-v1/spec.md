# Feature 089 — Official national source coverage pack v1

## Status

Approved for repository implementation by the product owner in this session. Merge, production corpus mutation and deployment remain human-gated.

## Problem

The product now distinguishes documentary coverage gaps from negative legal conclusions, but two material problems remain:

1. The municipal water workflow asks for a generic “documento o evidencia verificable” for many steps instead of identifying the concrete evidence class needed to resolve the gap.
2. The Guatemala national source pack points to a single MARN Category C page, which can bias users toward a category before the project has been classified under the official taxative list.

The national pack also omits reusable official sources for municipal financial administration, current SNIP standards, drinking-water health oversight, project water-quality certification and GUATECOMPRAS operating rules.

## Objective

Deliver a tenant-reusable, fail-closed official source coverage layer that:

- gives all 47 water-project research categories concrete required-evidence labels;
- exposes the same requirement in the static academy fallback;
- replaces the Category C-only environmental connector with a category-neutral classification connector;
- registers additional official national discovery sources without claiming acquisition or ingestion;
- validates non-template source-pack references against the governed source inventory;
- preserves the distinction between national authority, municipal practice and case-specific proof.

## Functional requirements

### FR-1 — Concrete gap requirements

Every water workflow category SHALL define at least one concrete required evidence item. Generic placeholders such as “Documento o evidencia verificable sobre …” SHALL NOT be emitted for this workflow.

### FR-2 — Static academy parity

The public academy fallback SHALL expose a `required_evidence` array for every one of the 47 categories and render it as “Fuente requerida” when live procedure evidence is unavailable.

### FR-3 — Environmental neutrality

The national source pack SHALL use the MARN taxative list as the classification entry point and MAY list category-specific pages as candidate sources. The connector and inventory limitations SHALL state that A, B1, B2 or C cannot be predetermined from the sector label alone.

### FR-4 — Official source expansion

The governed inventory and Guatemala national source pack SHALL add verified discovery records for:

- MAFIM second edition / Acuerdo Ministerial 558-2021;
- MARN taxative list;
- MARN category A, B1 and B2 pages, retaining the existing C page as a candidate only;
- SNIP standards 2027 catalog;
- MSPAS health-and-environment authority for drinking water;
- the government catalog procedure for water-quality certification in supply projects;
- GUATECOMPRAS Resolution 001-2022 discovery through the official MINFIN legal library.

### FR-5 — State semantics

New sources SHALL remain `verified`, not `acquired` or `ingested`, unless exact bytes, digest, safety, extraction and indexing evidence are present. They SHALL NOT increase runtime supported-step counts before governed ingestion.

### FR-6 — Source pack / inventory binding

Validation SHALL fail for a non-template source pack when:

- a referenced inventory ID does not exist;
- a required coverage tag is not supplied by any enabled connector;
- an inventory URL host is not within the connector allowlist;
- the same inventory ID is bound to multiple connectors in the same pack.

Template-only packs MAY retain placeholder inventory IDs.

### FR-7 — Authority boundary

Official national sources MAY support national requirements. They SHALL NOT prove that a municipal act, approval, payment, inspection, contract event or project status occurred. Case-specific steps SHALL continue to request the municipal expediente or act.

## Non-functional requirements

- HTTPS-only discovery URLs with no embedded credentials.
- Bounded connector and evidence arrays.
- Deterministic validation and tests.
- No raw official PDFs committed to Git.
- No external crawling during CI.
- No production Cloud SQL mutation or deployment in this node.
- No claim of general legal correctness.

## Acceptance criteria

1. The 47 workflow steps emit concrete `requiredEvidence` values.
2. The academy JSON has 47 non-empty `required_evidence` arrays and renders the first value.
3. The MARN source connector is classification-neutral and binds taxative-list plus category candidates.
4. Nine new verified inventory records reconcile with the national source pack.
5. Binding validation passes for all non-template source packs and has negative tests.
6. Focused tests, full tests, typecheck, build, source-pack validation, inventory validation and Graph Harness validation pass.
7. Critic/red-team and independent-verifier reports explicitly test category bias, authority promotion and false ingestion claims.
8. Remote CI is green for the exact functional head before release-gate evaluation.

## Explicit exclusions and blockers

- Acquiring, scanning, extracting or indexing the newly verified sources.
- OCR of the seven scanned municipal PDFs.
- Mutating the managed corpus or public projection.
- Merging PR #33 or this successor PR.
- Deploying Cloud Run or GitHub Pages.

These actions require separate authorization and evidence.
