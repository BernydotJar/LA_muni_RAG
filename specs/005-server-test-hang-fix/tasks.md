# 005 Server Test Hang Fix Tasks

Status: Implemented

## Completed

- Read local instruction files when present.
- Read server, HTTP, DB, and server integration test code.
- Identified unawaited server shutdown and duplicated routing as the lifecycle
  risk.
- Refactored `src/server.ts` to export `createRequestHandler()`,
  `createApiServer()`, and `startServer()`.
- Updated `src/__tests__/server.test.ts` to use the real server factory.
- Updated test teardown to await `server.close()` before `closeDb()`.

## Validation

- `npm run typecheck`
- `npm run build`
- `npm run test`
