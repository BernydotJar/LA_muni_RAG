# Tasks: RAG Glass Wall Easter Egg

Feature: 019-rag-glass-wall-easter-egg  
Mode: SHIP  
Status: spec_ready

## Files You May Read

- AGENTS.md
- RTK.md
- CLAUDE.md
- feature_list.json
- progress/current.md
- progress/history.md
- src/server.ts
- src/__tests__/server.test.ts
- public/**
- specs/019-rag-glass-wall-easter-egg/**

## Files You May Touch During Spec Phase

- feature_list.json
- progress/current.md
- progress/history.md
- specs/019-rag-glass-wall-easter-egg/requirements.md
- specs/019-rag-glass-wall-easter-egg/design.md
- specs/019-rag-glass-wall-easter-egg/tasks.md

## Files You May Touch During Implementation After Approval

- public/glass-wall.html
- src/__tests__/glass-wall-static.test.ts
- feature_list.json
- progress/current.md
- progress/history.md

## Files You Must Not Touch

- env files
- secrets
- migrations
- package files unless separately approved
- LLM answer generation
- LLM reranking
- retrieval ranking policy
- vector ranking policy
- auth
- database layer
- ingestion pipeline
- corpus manifest logic
- server routes unless separately approved

## Task 1: Create Spec Package

Create:

- requirements.md
- design.md
- tasks.md

## Task 2: Approval Gate

Stop after the spec package.

Do not implement the glass wall until explicit human approval.

## Task 3: Inspect Existing Static Serving

After approval, inspect the server/static asset behavior to confirm `public/glass-wall.html` can be served without server route changes.

## Task 4: Build Static Glass Wall

Create `public/glass-wall.html` as a self-contained HTML/CSS/JS page.

It should:

- accept a query
- call existing safe endpoints
- render query, retrieval modes, evidence candidates, and final status as a node graph
- handle not_found/degraded/error states safely

## Task 5: Add Static Safety Test

Add an offline test to verify:

- the glass wall static file exists
- expected DOM anchors exist
- only approved endpoint paths are referenced
- obvious secret marker strings are absent

## Task 6: Verification

Run:

```bash
npm run typecheck
npm run build
npm run test
```

## Done Criteria

The feature can move to review when:

- glass-wall spec exists
- static glass wall implementation exists
- no new server route is required
- no secrets, prompts, or chain-of-thought are exposed
- static safety test exists
- local verification passes
