# GCP production blueprint

Status: architecture target only; no project, billing account or resource has
been created by this repository.

## Target topology

```text
GitHub Pages or approved static hosting
        |
        | HTTPS, exact CORS origin, no browser service credential
        v
External HTTPS Load Balancer + Cloud Armor (production)
        |
        v
Cloud Run public-query gateway/BFF
        |
        +--> Cloud Run authenticated API
        |       |
        |       +--> Cloud SQL PostgreSQL + pgvector
        |       +--> Secret Manager
        |
        +--> Pub/Sub / Cloud Tasks
                |
                +--> Cloud Run Job or worker service
                        +--> Cloud Storage immutable objects
                        +--> malware/OCR/extraction sandbox

Artifact Registry -> immutable API/worker image digests
Cloud Logging + Monitoring -> sanitized logs, metrics, alerts and SLO evidence
```

## Initial cost controls

These are design constraints, not deployed settings:

- Cloud Run API/gateway minimum instances: `0` until latency requirements justify
  a reviewed change.
- Cloud Run maximum instances: start at `2` for staging and a separately approved
  production value.
- Concurrency and request timeout are bounded and load-tested before promotion.
- Cloud SQL uses the smallest approved non-HA staging shape first. Production HA,
  PITR, storage auto-growth and maintenance policy require explicit approval.
- Budget alerts and quota caps are configured before any billable environment.
- GPU/OCR workers are off by default and cannot scale from public traffic.

## Workload separation

- `la-muni-public-gateway`: anonymous/public boundary; public corpus only; no
  tenant selection; strict request/rate/body limits.
- `la-muni-api`: authenticated tenant APIs; non-owner DB role; no background work.
- `la-muni-migrations`: one-shot reviewed Cloud Run Job with migration identity.
- `la-muni-ingestion-worker`: private worker identity; object/scanner access;
  queue leases and fencing.
- `la-muni-ocr-eval`: optional isolated evaluation workload, never part of the
  default production request path.

## Required secrets

Secret Manager entries are referenced by version and workload identity:

- database runtime URL or connector material;
- migration database credential;
- provider credentials, if a reviewed provider is enabled;
- integration credentials for server-to-server consumers;
- scanner/object-storage credentials only where workload identity is insufficient.

No secret is injected into GitHub Pages, source control, Terraform variables in
plain text, image layers or command output.

## Public query gateway controls and remaining enablement gates

The repository implementation now provides the contract, server-bound tenant configuration, lexical-only retrieval, HMAC rate buckets, minimized audit and forced-RLS retrieval gates. Production enablement still must prove:

1. one authorized, ingested and human-reviewed public tenant/corpus;
2. approved project, region, budget, workload identity and Secret Manager wiring;
3. exact production origin and Pages `PAGES_API_URL`;
4. Cloud Armor plus quota/load/abuse evidence beyond database rate buckets;
5. production grants, logs, metrics, alerts and SLOs;
6. privacy, retention, recovery, rollout and observation evidence.

## Environment promotion

1. local disposable services;
2. ephemeral staging with synthetic fixtures;
3. persistent staging with approved non-production data;
4. public-corpus pilot with named reviewers;
5. production canary with zero/bounded traffic;
6. progressive traffic and observation;
7. explicit close or rollback record.

No step is implied by passing repository CI.
