# 005 Server Test Hang Fix Requirements

Status: Implemented

## Objective

Make `npm run test` complete cleanly by fixing HTTP server and PostgreSQL pool
lifecycle ownership in `src/__tests__/server.test.ts`.

## Acceptance Criteria

- `src/server.ts` can be imported without starting a real listener.
- Integration tests create a test server on an ephemeral port.
- Integration tests await server shutdown before closing PostgreSQL.
- `/api/answer` behavior remains unchanged.
- Existing endpoint behavior remains unchanged.
- `npm run typecheck`, `npm run build`, and `npm run test` complete.

## Non-Goals

- No endpoint contract changes.
- No search, evidence, answer, or chat behavior changes.
- No package script or dependency changes.
