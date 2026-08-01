# Feature 089 — Critic / Red Team review

## Scope reviewed

- `config/source-packs/guatemala-municipal-core.json`
- `.rag/source-inventory.json`
- `src/sources/sourcePack.ts`
- `src/cli/validateSourcePacks.ts`
- `src/domain/packs/municipal-antigua-water.ts`
- `public/data/water-training-map.json`
- `public/procedure-training.js`

## Findings

### RT-089-01 — Category C anchoring bias

**Severity:** high  
**Status:** fixed

The predecessor national pack used a connector named `marn-environmental-category-c` and exposed only the Category C route. A user could reasonably misread this configuration as a predetermined classification for municipal water projects.

**Repair:** the connector now starts at the official MARN taxative lists and exposes A, B1, B2 and C only as candidate routes. Inventory limitations state that category depends on the project, scale, location, components and current taxative list. The `Ambiente` workflow step asks for documented classification plus the instrument corresponding to the category actually determined.

### RT-089-02 — Approved-scope count mismatch

**Severity:** medium  
**Status:** fixed

The initial specification said eight new records but enumerated nine independently governed sources. Implementing only eight would have silently omitted either MSPAS authority context or the case-specific certification procedure.

**Repair:** specification, project metadata, tests and evidence now consistently require nine records. The revised scope is recorded in the Graph Harness approval chain.

### RT-089-03 — Government catalog hostname mismatch

**Severity:** medium  
**Status:** fixed

The official catalog URL used `www.tramites.gob.gt`, while the initial allowlist contained only `tramites.gob.gt`. Cross-validation failed as designed.

**Repair:** both exact official hosts are explicitly allowlisted at pack and connector level. No wildcard or suffix matching was introduced.

### RT-089-04 — Verified-source promotion risk

**Severity:** high  
**Status:** mitigated and tested

A discovery URL could be mistaken for acquired, scanned or indexed content.

**Repair:** all nine records remain `verified`; acquisition, artifact-safety, extraction and indexing evidence are absent. Focused tests assert this boundary for every record. The source-verification receipt states that zero bytes were acquired or committed.

### RT-089-05 — National rule mistaken for municipal event

**Severity:** high  
**Status:** mitigated and tested

MAFIM, SNIP, MARN, MSPAS and GUATECOMPRAS can establish national authority, but cannot prove that Antigua received a request, approved a project, awarded a contract, performed an inspection or made a payment.

**Repair:** concrete requirements for case-specific steps demand the actual act, expediente, certification, contract record, inspection or accounting support. Each new inventory record carries an explicit non-proof limitation.

### RT-089-06 — Generic fallback survives in the academy

**Severity:** medium  
**Status:** fixed

The static academy could still display a generic request even after the API model became more specific.

**Repair:** every category now contains a non-empty `required_evidence` array in exact parity with the domain pack. Runtime validation rejects generic placeholders and the UI renders `Fuente requerida` from bounded text only.

### RT-089-07 — Source-pack drift from inventory

**Severity:** high  
**Status:** fixed

Before this feature, a non-template pack could reference an unknown inventory ID, leave a required coverage tag unsupported, bind one inventory ID to multiple connectors or attach a record whose public URL host was outside the connector allowlist.

**Repair:** deterministic cross-validation now fails closed on all four conditions. Template-only enterprise packs retain placeholders without becoming production-eligible.

## Attack matrix

| Attack | Expected result | Observed result |
| --- | --- | --- |
| Add unknown inventory ID | validation failure | pass |
| Bind one source ID twice | validation failure | pass |
| Add uncovered required tag | validation failure | pass |
| Change official URL to unapproved host | validation failure | pass |
| Reintroduce generic required evidence | focused test failure | pass |
| Default environmental step to C | focused test failure | pass |
| Promote new record to ingested without evidence | inventory/focused test failure | pass |
| Use national source as proof of municipal occurrence | explicit limitation and case-source requirement | pass |

## Residual risks

- Two official sites returned HTTP 403 to the automated verifier. Their identity was corroborated through official indexed pages, but immutable browser acquisition remains pending.
- Current URLs and page summaries are discovery evidence, not current-vigencia legal opinions.
- The nine sources are not yet in retrieval. Acquisition, malware scanning, extraction, indexing, tenant RLS, applicability review and citation testing remain separate nodes.
- The seven scanned municipal PDFs still require an approved OCR and human-review protocol.

## Critic conclusion

The functional design is suitable for independent verification. It removes the known classification bias and generic evidence language without overstating corpus coverage.
