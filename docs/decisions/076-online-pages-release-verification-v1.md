# Decision 076 — Bind Pages verification to the deployed Git SHA

## Decision

Every generated Pages artifact carries one exact full Git SHA in HTML and in a bounded metadata
file. A deployment is not accepted merely because GitHub reports success: a post-deployment
Chromium job must observe the same SHA at the public URL and verify core public-product behavior.

The existing Pages URL currently serves a legacy `main` publication rather than the product
artifact on the feature branch. That URL is useful as drift evidence but does not satisfy the
public browser gate or online release verification.

## Rationale

A green build can still publish stale content, a legacy Jekyll site, the wrong branch, or a cached
artifact. Exact SHA binding converts the public URL into verifiable release evidence and prevents
manual inspection from silently testing a different revision.

## Consequences

Future Pages deployments perform an additional Chromium installation and online smoke. A public
deployment still requires human authorization because the repository has one Pages site and a
workflow dispatch from a feature branch would replace the currently public content. Rollback must
be tied to an explicit prior SHA or a separately approved main deployment.
