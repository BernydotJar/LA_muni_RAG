# Feature 090 implementation plan

## Producer

1. Add the successor Graph Harness node and gate.
2. Add a bounded acquisition-plan schema and Guatemala national HTML plan.
3. Implement pure validation, DNS/redirect policy, bounded fetch, structural inspection, scanner gate, extraction and inventory transition.
4. Add Windows-1252 HTML support without weakening non-HTML text inspection.
5. Add CLI and atomic persistence.
6. Install/update ClamAV in the isolated workspace and execute the live plan.

## Critic / Red Team

Attack:

- source ID not bound to the selected pack;
- duplicate source binding;
- HTTPS hostname resolving to loopback, link-local, RFC1918, documentation or multicast ranges;
- redirect to a different or unapproved host;
- missing or misleading content type;
- decompression/body limit overrun;
- binary data disguised as legacy HTML;
- executable script leakage into extraction;
- scanner unavailable, stale/incomplete identity, infection or snapshot mutation;
- path traversal and pre-existing mismatched artifacts;
- insufficient page content being promoted;
- blocked source being changed from `verified`;
- successful source being promoted directly to `ingested`.

## Fixer

Repair every reproducible finding without relaxing host, DNS, bytes, scan, extraction or inventory-state gates.

## Independent verifier

Verify the functional commit in a clean detached worktree with mocked deterministic network tests, live-library receipt reconciliation, full regression, audit and Graph Harness replay. Raw ignored artifacts SHALL be mounted read-only for receipt verification only.

## Release gate evidence

- `acquisition_policy`
- `artifact_safety`
- `extraction_validation`
- `adversarial_review`
- `independent_regression`
- `remote_ci`

## Publication

Create a stacked draft PR based on `feature/official-source-coverage-pack-v1`. Merge and deployment remain unauthorized.
