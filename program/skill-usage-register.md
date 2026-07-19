# Skill usage register

Last updated: 2026-07-19T05:54:37Z

Program source: /Volumes/Cool HD 2TB/Downloads/goal_la_muni_rag_procedural_intelligence_prod_ready.md

Repository baseline observed during this audit:

- branch: program/procedural-intelligence-prod-ready
- base and observed commit: origin/main at 4950ba3
- divergence from origin/main: 0 ahead / 0 behind
- canonical gate: 371/371 tests; typecheck, build, inventory validation, domain evaluation, and Pages verification passed
- source inventory: valid, 16 total documents, 3 verified, 5 missing_source, 0 acquired, and 0 ingested; verification is not acquisition or ingestion
- current source inventory after controlled DMP acquisition: valid, 17 total, 4 verified, 4 missing_source, 1 acquired, and 0 ingested
- pre-existing untracked file: RTK.md

## Skill-first decision log

| task_id | task | skill considered | decision | inputs | outputs | evidence | result |
|---|---|---|---|---|---|---|---|
| PRG-SKILL-001 | Bootstrap the program tooling controls | Current session skill catalog | No listed skill specifically covers AutoSkills, Context7/Farmtable availability auditing, or fallback program ledgers. Manual execution was selected. | Goal sections 12-16 and 20; RTK.md; package.json; current tool inventory | This register, Context7 evidence, task graph, task ledger | Initial API tool inventory search returned an empty array. Candidate skills such as skill-creator and plugin-creator target creation rather than this audit; repository-specific RICE skills target a different repository. Context7 was subsequently resolved through its CLI via npx. | completed |
| PRG-RTK-001 | Follow repository command-output guidance | RTK repository toolkit | Used as command tooling, not as a Codex skill. No installation or initialization was performed. | RTK.md | Compressed repository inspection output | command -v rtk returned /opt/homebrew/bin/rtk; rtk --version returned rtk 0.34.1 | completed |
| PRG-AUTO-001 | Run the required AutoSkills dry-run without permitting a fetch or install | AutoSkills CLI 0.3.6 from the existing npm cache | Executed in offline dry-run mode. Installation was rejected pending license and review closure. | package.json; cached AutoSkills registry | Detected stack and six proposed skills listed below | npx --offline autoskills --dry-run exited 0 and ended with “--dry-run: nothing was installed.” | completed_with_limitations |
| PRG-CTX7-001 | Enable the Context7 evidence workflow | Context7 CLI via npx | CLI fallback activated without requiring a standalone executable. Eight libraries were resolved and queried; task-specific evidence remains mandatory. | Node v26.5.0 runtime; PostgreSQL/RLS; OpenAPI 3.1.1; JSON Schema object validation; Ajv validation; Docker; pgvector; ClamAV scanning | Versioned records and implementation decisions in program/context7-evidence.md | npx ctx7 v0.5.5, MIT, github.com/upstash/context7; current records include /docker/docs, /pgvector/pgvector, and /cisco-talos/clamav. | completed |
| PRG-FARM-001 | Initialize Farmtable or its semantic fallback | Farmtable CLI/MCP | Farmtable is unavailable. The required YAML graph and ledger are the active runtime of record. | Current API tool inventory and PATH; goal section 15 | program/task-graph.yaml and program/task-ledger.yaml | No Farmtable-related API tool was present; ft --version exited 127 with “zsh:1: command not found: ft”. | fallback_active |
| BOUND-001 | Establish canonical product boundaries and architecture | No listed repository-specific documentation skill applies to LA Muni RAG | Manual documentation-as-code workflow with explicit link verification. | Goal ownership, non-overlap, contracts, system context, data ownership | Nine canonical documents across docs/product, docs/architecture, and docs/integrations | Nine required documents exist; link audit checked 70 links with 0 broken. | completed |
| WS02-CORP-RECON-001 | Reconcile PDM-OT source truth without promoting lifecycle state | No listed corpus-reconciliation skill applies | Manual inventory, dry-run, portable identity, documentation, and focused-test workflow. | Existing PDM-OT official URL, version/date/hash metadata, optional local bytes, Feature 054 importer | Reconciled inventory and docs/data/source-inventory.md | missing_source to verified; no acquired/ingested claim; Feature 054 dry-run planned/mutated false; 15/15 focused tests and typecheck passed. | completed |
| WS02-DMP-ACQ-001 | Verify the official Antigua procedure-manual catalog and acquire the DMP v3 artifact | No listed corpus acquisition or malware-quarantine skill applies | Used authoritative-source research followed by the existing Feature 054 local import boundary; did not use a skill intended for unrelated repositories. | Official municipal catalog/API/PDF URL; metadata-only verification; bounded temp download; Feature 054 dry-run and import | Verified catalog, acquired DMP v3 record, portable bounded path, SHA-256 evidence, focused tests | Catalog missing_source to verified; DMP acquisition_pending to acquired; 49,052,885 bytes; SHA-256 4cbd35993b345c1f2bdb308825f1d3a6cac24ad239bdc9b087e2d99f2297e8f9; repeat import noop; 15/15 focused tests and typecheck passed. | completed_with_limitations |
| WS03-ARTIFACT-SAFETY-001 | Add a fail-closed local artifact safety, malware, and quarantine gate | No listed skill targets this repository's Node CLI, local document library, or ClamAV boundary | Used the repository workflow plus Context7 Node/ClamAV evidence and official ClamAV primary documentation; no unrelated repository-specific skill was used. | Feature 054 importer; acquired-only DMP state; Node execFile boundary; ClamAV scanning/file-magic guidance | Structural/MIME/size gate, fixed scanner adapter, bounded evidence, no-replace quarantine/retry, ingestion enforcement, runbook, tests | Commit 37ff0ad; 43/43 focused and 479/479 global tests; typecheck/build/inventory/contracts/domain/link gates pass; real DMP dry-run remains noop with artifactSafety null and no mutation; real scanner absent. | completed_with_limitations |
| WS08-PROCEDURE-QUERY-001 | Implement and adversarially verify the procedure-query v1 provider | No listed skill targets this repository's Node/PostgreSQL API implementation | Used the repository contract/security foundations, Context7 evidence, direct code review, focused adversarial tests, and a guarded disposable PostgreSQL/HTTP gate. | Canonical v1 schemas/OpenAPI; identity/RBAC/RLS foundation; PostgreSQL 16.14/pgvector 0.8.5 disposable runtime | Secure provider, migration 004, public-only scoped retrieval, production legacy gate, DB fixture, HTTP smoke, current docs | Commit deef177; 35/35 focal tests; canonical Node summary 457/457 in a clean detached worktree; prior 539 reporter-marker count corrected; contract/inventory/domain/Pages/build/typecheck gates; 0 production dependency vulnerabilities; DB/HTTP statuses 200/200/409/403/400/401/500/200 and legacy 404. | completed_with_limitations |

## Context7 activation evidence

- invocation: npx ctx7
- CLI version: 0.5.5
- license: MIT
- repository: https://github.com/upstash/context7
- resolved libraries: /nodejs/node, /websites/postgresql_current, /oai/openapi-specification/3.1.1, /websites/json-schema_understanding-json-schema, /ajv-validator/ajv/v8.17.1, /docker/docs, /pgvector/pgvector, /cisco-talos/clamav
- retrieved topics: timingSafeEqual/hash/randomUUID and execFile process bounds; PostgreSQL RLS default-deny and FORCE; OpenAPI bearer security/components/JSON Schema; strict JSON Schema object validation; Ajv2020 strict/allErrors/addSchema; Docker multi-stage/non-root/health checks; pgvector versioned runtime setup; ClamAV scanning, limits, and file-type magic
- task result: BLK-CTX7-001 resolved and PRG-CTX7-001 completed
- limitation: Context7 Node documentation reaches v25 while the observed runtime is v26.5.0; v26-specific decisions require matching primary documentation
- Ajv implementation selection: ajv 8.20.0 and ajv-formats 3.0.1
- Ajv limitation: Context7 documentation is pinned to v8.17.1; compatibility with selected ajv 8.20.0 must be verified before passing the contract gate

## Completed program slices

### BOUND-001

Canonical documents:

1. docs/product/product-boundaries.md
2. docs/product/procedural-intelligence-vision.md
3. docs/architecture/bounded-contexts.md
4. docs/architecture/system-context.md
5. docs/architecture/data-ownership.md
6. docs/integrations/os-electoral.md
7. docs/integrations/content-agency.md
8. docs/integrations/contracts.md
9. docs/data/source-inventory.md

The canonical set contains 70 checked links and 0 broken links.

### WS02-CORP-RECON-001

- PDM-OT lifecycle transition: missing_source to verified
- deliberately unchanged lifecycle states: acquired false; ingested false
- portable identity: official URL, version, verification date, and SHA-256
- optional local-byte check: matching bytes verified without making the artifact a portable acquisition
- Feature 054 import check: dry-run with planned true and mutated false
- inventory summary: 16 total, 3 verified, 5 missing_source, 0 acquired, 0 ingested
- verification: 15/15 focused tests and typecheck passed
- parent workstream: WS02-CORP-001 remains in_progress and partial

### WS02-DMP-ACQ-001

- official Antigua procedure-manual catalog: missing_source to verified
- individual DMP v3 manual: acquisition_pending to acquired
- acquired bytes: 49,052,885; PDF 1.4; copied-byte SHA-256 `4cbd35993b345c1f2bdb308825f1d3a6cac24ad239bdc9b087e2d99f2297e8f9`
- controlled path: repository-relative under the Git-ignored `.rag/library/` root
- repeated import: noop with mutated false
- current inventory: 17 total, 4 verified, 4 missing_source, 1 acquired, 0 ingested
- verification: 15/15 focused tests and typecheck passed
- limitations: no durable object store, real scanner runtime or clean DMP malware verdict, extraction, indexing, corpus-manifest reconciliation, validity approval, or reuse license; local safety/quarantine capability now exists at 37ff0ad
- parent workstream: WS02-CORP-001 remains in_progress and partial

### WS03-ARTIFACT-SAFETY-001

- commit: `37ff0ad`
- acquisition gate: bounded size, explicit MIME, extension, PDF/DOCX/text structural signatures, reread hash, and no-replace publication
- scanner boundary: fixed `clamdscan`/`clamscan`, `execFile` without shell, bounded timeout/output, stable clean/infected/error mapping
- enforcement: matching current safety evidence is mandatory before extraction; exact verified buffer is handed to vector indexing
- recovery: absent/error/infected/tampered artifacts fail closed; applied failures move by no-replace hard link to bounded quarantine and support a clean retry
- verification: 43/43 focused; 479/479 global; typecheck/build/inventory/contracts/domain passed; ten changed Markdown files had zero missing local links
- real DMP check: repeat import dry-run was noop, artifactSafety null, mutated false, zero sections/chunks; inventory and bytes were not changed
- limitations: no real ClamAV runtime/definitions/monitoring, no DMP verdict, no authenticated or durable library, no job/lock/audit layer, no generic raw-PDF extraction, and no tenant-scoped vector write
- parent workstream: WS03-ING-001 is now in_progress and remains partial

### WS08-PROCEDURE-QUERY-001

- provider: `POST /api/v1/procedure-queries`, `requested_output=procedure_workflow` only
- commit: `deef177`
- controls: Bearer digest auth, `integration:query`, tenant/credential match, strict Ajv, body/rate limits, exact CORS, idempotency, bounded audit, public/active/processed retrieval, draft mapping, boundary refusal
- negative evidence: cross-tenant 403, exact replay/conflict, corrupt replay invalidation/retry, no raw token/key/question in audit details, non-CORS legacy 404 in production
- database gate: PostgreSQL 16.14, pgvector 0.8.5, non-owner/non-`BYPASSRLS` role, full migration order
- verification: 35/35 focused; canonical Node summary 457/457 at `deef177` in a clean detached worktree; contracts/inventory/domain/build/typecheck/Pages passed; `npm audit --omit=dev` found 0 vulnerabilities
- count correction: the prior 539 figure counted reporter markers and was not the Node test summary
- limitations: no OS Electoral consumer, EvidenceBundle/Assessment provider, lifecycle/approval store, staging/load test, production role/platform, or deployment

## AutoSkills dry-run evidence

The exact goal command was constrained to offline mode so npx could not fetch or install a package:

    npx --offline autoskills --dry-run

Observed result:

- exit code: 0
- AutoSkills version: 0.3.6
- detected technologies: TypeScript and Node.js
- reported target agents: universal and kiro-cli
- reported action: six skills proposed
- repository writes: none observed
- skills-lock.json: absent
- standalone autoskills executable on PATH: absent
- package source: existing npm npx cache at /Users/eduardosacahui/.npm/_npx/4ee5619d4353c7f4/node_modules/autoskills
- cached package license: CC-BY-NC-4.0
- cached package package.json SHA-256: 43b3ef91d99553ed3a83e7f7af87c646a8006709ca966952db003a7fe1386781
- cached registry SHA-256: 12b50d1562e4b84a9e3ae051c0cd64532ff15c3f14202d32ec38a66d440103b0
- cached registry generatedAt: 2026-05-03T15:50:34.696Z
- cached registry reviewer metadata: model gpt-5.4, promptVersion 1.0.0

### Proposed skill manifest

| skill | source and path | pinned commit | bundle SHA-256 | files | registry review evidence |
|---|---|---|---|---|---|
| typescript-advanced-types | wshobson/agents/typescript-advanced-types | 87b81e9d642d7bb9602b33d1e2dadf1c2a619f2b | 5ca0e177c6aaaba1889255691224daafdb7d71f317cc70bede1590d3907ded42 | SKILL.md | status approved, but summary says “review skipped (--no-review)”; prompt-injection review is not proven |
| nodejs-backend-patterns | wshobson/agents/nodejs-backend-patterns | 87b81e9d642d7bb9602b33d1e2dadf1c2a619f2b | 710a5e6f83c46e8f6c43356df55c143a7375c4414559a581654ce51709138c55 | SKILL.md; references/advanced-patterns.md | status approved, but summary says “review skipped (--no-review)”; prompt-injection review is not proven |
| nodejs-best-practices | sickn33/antigravity-awesome-skills/nodejs-best-practices | 1930a079452fa15a54b6b4232a89d8a3f75c3239 | 7361ab02fb6b09913e3bdd9cf61c629ed6c17de9485e6a781054e5d437ccfc29 | SKILL.md | review approved and securityCheck status ok with no findings |
| frontend-design | anthropics/skills/frontend-design | 2c7ec5e78b8e5d43ea02e90bb8826f6b9f147b0c | 82fb11a63fb1e35ee2469516ed02d54695f783115b1540c0e783197af4240a3a | LICENSE.txt; SKILL.md | status approved, but summary says “review skipped (--no-review)”; prompt-injection review is not proven |
| accessibility | addyosmani/web-quality-skills/accessibility | fed9617111260e19f4f54b72a2874a3f3de8ff94 | bffe3d08cfe92ebad63699f74ce29e35c19850ebfbf474c1463183cfe34d6a09 | SKILL.md; references/A11Y-PATTERNS.md; references/WCAG.md | status approved, but summary says “review skipped (--no-review)”; prompt-injection review is not proven |
| seo | addyosmani/web-quality-skills/seo | fed9617111260e19f4f54b72a2874a3f3de8ff94 | c184da724d1c61ad077f27418ea8e7e88fd54bcdf98165e18be7e4681cbd5e20 | SKILL.md | status approved, but summary says “review skipped (--no-review)”; prompt-injection review is not proven |

### Installation decision

No skill was installed and no skills-lock.json was created.

Reasons:

1. The registry does not declare the license of each proposed skill. A bundled LICENSE.txt hash for frontend-design is not a license determination.
2. Five proposals have internally inconsistent review evidence: status approved while the review summary says review skipped.
3. Commit and content hashes reduce ambiguity but do not prove publisher identity, artifact provenance, or freedom from supply-chain compromise.
4. The AutoSkills package itself is CC-BY-NC-4.0. Its permissibility as development tooling and any distribution implications need explicit legal review for a commercial product.
5. The proposed target set includes universal and kiro-cli; the intended repository-local installation paths and agent scope were not printed by the dry-run.

Before any installation, require an owner to verify every skill file, license, destination path, publisher provenance, and hash against the pinned manifest. If approved, run the non-dry command separately, review the diff, and only then register skills-lock.json.

## Audit limitations

- npm view --offline autoskills@0.3.6 dist --json returned ENOTCACHED, so registry-provided tarball integrity and shasum were not independently recovered.
- npm cache verify returned EPERM while attempting to inspect a root-owned cache entry. No privilege escalation or ownership change was attempted, so whole-cache integrity remains unverified.
- This audit did not download source repositories, execute proposed skill content, or infer licenses from repository names.
- RTK.md was already untracked before the audit and was read only.
- Context7 availability is resolved through npx, not through a standalone PATH executable or MCP operation.
