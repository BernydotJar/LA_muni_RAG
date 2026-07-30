# Decision Log — Feature 057

## D-057-01 — Enqueue only an existing immutable registry version

The API accepts a `document_version_id` and its already recorded SHA-256. It
accepts no upload, URL, local path, title, or source metadata.

Reason: source acquisition, document approval, and artifact acceptance are
separate administrative/security boundaries. Enqueue must not bypass them.

## D-057-02 — Authenticate and rate-limit before parsing

Bearer authentication and the tenant/principal/operation rate gate finish
before request body bytes are parsed. Permission and contract checks follow.

Reason: unauthenticated or over-limit traffic must not trigger JSON allocation,
schema work, or durable ingestion calls.

## D-057-03 — Keep the pipeline server-owned

The only public profile is `municipal_document_v1`; the server supplies the
extractor, planner, provider, model, dimension, and attempt policy.

Reason: callers must not select a cheaper/weaker parser, incompatible vector
space, unapproved provider, or retry amplification policy.

## D-057-04 — Use uniform authorization and resource denials

Permission and tenant mismatches use the same 403. Missing, cross-tenant, and
inactive-profile job reads use the same 404.

Reason: response differences must not become a tenant/object existence oracle.

## D-057-05 — Return operational state without control material

Responses include status/timing/provenance but omit artifact digest, provider,
model, raw idempotency key, worker identity, and lease token.

Reason: authorized status readers need workflow visibility, not replayable
credentials or unnecessary artifact/pipeline fingerprints.

## D-057-06 — Separate tenantless authentication aggregation

Migration `006` uses a fixed-route, fixed-event, allowlisted-reason aggregate
behind a revoked `SECURITY DEFINER` function.

Reason: failed authentication cannot truthfully name a tenant, and one audit row
per anonymous attempt would create an amplification primitive.

## D-057-07 — Require an injected immutable artifact resolver

The worker has no filesystem, URL, or global object-store default.

Reason: storage identity, IAM, immutable generations, and clean-scan evidence
must be supplied by a separately reviewed adapter rather than inferred from a
path or mutable alias.

## D-057-08 — Verify and privately copy bytes before parsing

The worker validates scope, immutable object version, filename/media structure,
digest, and current clean evidence, returns a private buffer, then rehashes after
extraction.

Reason: scanner/parser inputs must be the same accepted bytes, and a parser must
not silently mutate the artifact later committed under the original identity.

## D-057-09 — Reuse durable leases and atomic completion

The worker heartbeats and checkpoints while parser/provider work remains outside
the final database transaction, then calls the Feature 056 fenced completion.

Reason: a new API/worker layer must not create a second queue protocol or weaken
the existing stale-worker and atomic-generation guarantees.

## D-057-10 — Do not imply worker deployment

No executable loop, scheduler, storage adapter, or container entry point is
added. Health always reports `workerConfigured: false`.

Reason: a callable class and synthetic test are not an operated worker.

## D-057-11 — Keep CI synthetic and non-deploying

The SQL/service/API gates use only generated fixtures and report zero controlled
artifact reads. The workflow has no deployment permission or step.

Reason: production-readiness evidence must not silently broaden artifact access
or release authority.

## D-057-12 — Close connections for deliberately unread request bodies

Authentication, permission, rate, and early-header denials do not consume body
bytes. Their bounded response disables keep-alive and sends `Connection: close`;
framed bodies on `GET` are rejected under the same rule.

Reason: Node HTTP request bodies are readable streams that can remain paused
when unconsumed. Draining arbitrary rejected input creates a bandwidth sink,
while reusing the paused socket can pin request/connection state.
