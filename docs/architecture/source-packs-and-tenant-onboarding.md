# Source packs and tenant knowledge onboarding

## Purpose

LA Muni RAG separates product behavior from customer-specific evidence. A tenant is configured through three governed layers:

1. **Tenant knowledge profile** — identifies the organization, jurisdiction, language, branding, domain pack and source packs.
2. **Domain pack** — defines workflow types, classifier rules, evidence patterns, authority classes and validation warnings.
3. **Source packs** — define official discovery endpoints, allowlisted hosts, expected source inventory records, coverage tags, media types and refresh policy.

The corpus is not considered usable merely because a URL appears in a source pack. Every document still passes the source inventory, immutable acquisition, digest verification, malware scan, extraction, indexing, tenant RLS and public-projection gates.

## Configuration graph

```text
tenant knowledge profile
  ├── domain pack
  │     ├── workflow templates
  │     ├── classifier rules
  │     ├── evidence patterns
  │     └── authority policy
  └── source packs
        ├── official municipal or enterprise sources
        ├── national or sector-wide sources
        ├── comparative sources
        ├── refresh policy
        └── coverage tags
              ↓
        source inventory
              ↓
        governed acquisition and scan
              ↓
        extraction / OCR review
              ↓
        tenant-scoped indexing
              ↓
        procedure coverage metrics
```

## Repository locations

- Tenant profiles: `config/tenant-profiles/`
- Source packs: `config/source-packs/`
- Domain packs: `src/domain/packs/`
- Source inventory: `.rag/source-inventory.json`
- Tenant profile validator: `npm run tenant-profiles:validate`
- Source-pack validator: `npm run source-packs:validate`
- Source inventory validator: `npm run source-inventory:validate`

The current examples are:

- `config/tenant-profiles/antigua-guatemala.json`
- `config/source-packs/antigua-guatemala-2026.json`
- `config/source-packs/guatemala-municipal-core.json`
- `config/tenant-profiles/templates/enterprise-governance.json`
- `config/source-packs/templates/enterprise-governance.json`

## Onboarding a municipality

1. Create a tenant profile with the municipality name, jurisdiction, language, branding and selected domain pack.
2. Create a municipal source pack with only official municipal hosts and document catalogs.
3. Add the applicable national source pack for laws, investment, environment, procurement and sector authorities.
4. Register every expected source in the source inventory with an authority classification and limitations.
5. Acquire exact bytes or an immutable HTML snapshot. Record the URL, observed version, SHA-256, byte length and media type.
6. Run the malware and structural safety gates.
7. Extract text. A scanned PDF without text remains `failed/pdf_no_extractable_text` until it passes the separate OCR and human-review gate.
8. Ingest through the non-owner tenant runtime role and FORCE RLS.
9. Promote catalog state only after the accepted scan and processed job are the same generation.
10. Project public sections only for public, active, accepted and indexed sources.
11. Review procedure coverage. A pending step must show the missing source type rather than claim that the underlying rule does not exist.
12. Configure renewal before the accepted artifact window expires.

## Onboarding an enterprise

The same pipeline applies, but authority classes and confidentiality change:

- Corporate policies and board-approved standards are primary internal authority.
- SOPs and work instructions may support execution but do not override policy or contracts.
- Customer contracts and regulatory obligations require separate authority classes and access controls.
- Internal and restricted sources must never be projected to the public gateway.
- Connectors should target approved document systems or immutable exports, not arbitrary public crawling.
- A production tenant cannot reference a template-only source pack.

The enterprise template intentionally contains no live connector and uses `publicAccess: false`. A tenant administrator must replace placeholder hosts and connect approved repositories before activation.

## Source lifecycle states

| State | Meaning | May support a procedure step? |
| --- | --- | --- |
| `verified` | Official URL and provenance verified | No |
| `acquisition_pending` | Source known; immutable bytes not yet acquired | No |
| `failed/pdf_no_extractable_text` | Bytes acquired and clean, but extraction is blocked | No; show OCR/review required |
| `ingested` | Clean accepted bytes, successful extraction and tenant-scoped indexing | Yes, subject to authority and applicability |
| `superseded` | Preserved for audit but replaced by a newer version | Only for historical queries |

## Coverage semantics

Procedure coverage is computed from workflow steps, not from the number of documents alone:

- **Supported** — a citation matches the evidence patterns for the step and has an allowed authority class.
- **Inferred** — related evidence exists, but a human must confirm the relationship.
- **Coverage pending** — no applicable citation is present in the active tenant corpus. The response includes `coverageReason` and `requiredEvidence`.

The UI reports:

- coverage percentage;
- supported, inferred and pending step counts;
- number of retrieval queries and evidence items;
- required source for each pending step.

A low coverage percentage is an operational signal to acquire or review sources. It is not a claim that the municipality or company has no rule or procedure.

## Connector and security boundaries

- Discovery URLs must use HTTPS and contain no embedded credentials.
- Connector hosts must also appear in the source pack allowlist.
- Tenant profiles cannot reference unknown source packs.
- Production tenant profiles cannot reference template-only packs.
- A source pack tied to a domain pack cannot be attached to a different domain pack.
- HTML ingestion removes executable content and preserves heading-based citation paths.
- Malware-clean status, extraction success and indexing success are independent gates.
- Semantic claims remain disabled unless a production embedding provider and vector repository are configured.

## Current Antigua coverage boundary

The public Antigua tenant currently contains three ingested PDM-OT modules. Other official municipal sources such as the POA, organigram and selected procedure manuals have been located and acquired, but some are scanned PDFs without text. They remain outside retrieval until OCR accuracy and human review are approved. National source packs identify additional primary sources from SEGEPLAN, MARN, INFOM, MINFIN and the Congress, but an identified or verified source is not represented as ingested until the complete gate succeeds.

## National coverage pack v1.1

The Guatemala municipal core pack now binds every non-template connector to the governed source inventory. Validation fails when an inventory ID is unknown, bound twice, hosted outside the connector allowlist or when a required coverage tag is not supplied by an enabled connector. Template-only enterprise packs may keep placeholder IDs, but production tenant profiles still cannot attach them.

The pack adds verified discovery entries for MAFIM second edition, current SNIP standards, the MARN taxative lists and candidate A/B1/B2/C routes, MSPAS drinking-water authority and project certification, and Resolution 001-2022 for GUATECOMPRAS. These records remain `verified`; none is represented as acquired, malware-scanned, extracted or indexed.

Environmental classification is deliberately neutral. The connector begins with the taxative lists. Category-specific pages are candidate routes only after a reviewer determines the applicable category from the project activity, scale, location, components and current rule set.

The municipal water domain pack also supplies concrete evidence classes for all 47 research categories. National authority can support a national requirement, but the product requests the actual municipal act, expediente, inspection, contract event or financial record before claiming that a case-specific event occurred.
