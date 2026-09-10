# ADR 004 — Everything Is a Document

**Date:** 2026-08-23
**Status:** Accepted
**Implements:** Documents single-primitive (schema: `src/schemas/db/documents.ts`, validation: `src/schemas/schema.ts`, rendering: `src/components/mdx.server.ts`, editor serialization: `src/components/mdx-editor.ts` + `src/components/documents/Editor.tsx`)

## Context

The product accumulated (and planned) several content-shaped entities: a wiki,
merged updates/changelogs, specifications, bug reports, release/deployment
logs. Each would need its own table, router, and UI — three ways to write
"the same page", none interoperable. The (since-removed) `docs/TODO.md`
sketched the alternative:
"Documents: EVERYTHING IS A DOCUMENT … ONLY ISSUE MANAGEMENT".

Two existing primitives anchor the design space:

- **GitHub issues**: number, open/closed state, labels, comments, event
  timeline — the minimal, battle-tested shape of trackable written work.
- **MDX with frontmatter**: markdown plus typed metadata — content that is
  both human-readable source and machine-queryable data.

## Decision

Introduce a single content primitive, **Document**, defined by two equalities:

1. A document **is** a GitHub issue: per-user sequential `number`,
   `open|closed` state, labels, comments, append-only events.
2. A document **is** an MDX file with frontmatter: `body` stores complete MDX
   source; common frontmatter fields are mirrored into columns; kind-specific
   extras live in `meta`, validated per kind by Zod schemas.

Consequences enforced in code:

- No dedicated wiki/changelog/spec tables — ever. A new capability ships as
  kind + frontmatter schema + view; any new content table requires an ADR.
- Kind changes presentation and validation, never identity.
- Rendering compiles MDX server-side behind a safety allowlist (no imports/
  exports, no JS expressions, no JSX components); failures are recoverable
  errors shown in the UI, never crashes.
- Numbers allocate from a per-user counter row upserted transactionally with
  the insert — collisions impossible, numbers never reused.

## Alternatives considered

- **Separate entities per content type** (wiki table, changelog table): more
  upfront "clarity"; rejected — duplicates storage, search, comments, and
  lifecycle code N times and prevents cross-kind references (`#42`).
- **Markdown without frontmatter** (plain body + separate form fields):
  simpler pipeline; rejected — breaks the MDX-file equality that keeps stored
  source portable and diffable.

## Deferred

GitHub issue ⇄ Document sync (one-way ingest first) waits for an ADR on
conflict policy. The model already reserves the shape for it
(`number`/`state`/`labels`/events mirror GitHub).
