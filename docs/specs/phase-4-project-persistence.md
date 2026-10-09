# Phase 4 Specification — Project Persistence

Status: Implementation target  
Branch: `feat/phase-4-project-persistence`  
Base: `main`

## 1. Objective

Turn ANCHON's current single-design local save into a reliable multi-project workspace while preserving the existing editor, AI-generator handoff, PDF export, and submitted-blueprint lock.

## 2. Current-state findings

- `src/lib/storage.ts` stores one `DesignSubmission` in localStorage under `breachx-design`.
- `ParticipantPage` reads that singleton to reconstruct a draft or show the submitted-design chooser.
- The editor only writes the singleton when the user explicitly chooses Save Draft or Save Blueprint & Continue.
- `ArchitectureGeneratorPage` reads the same singleton and writes AI-generated graph state into it before opening the editor.
- `src/lib/db.ts` uses Supabase tables for event/team blueprint submissions and immutable submitted state, but the current editor persistence path is localStorage. The existing Supabase blueprint schema is event/team scoped and is not a suitable project CRUD store without a deliberate product/auth decision.
- The saved `DesignSubmission` type contains application name/description, nodes, edges, notes, optional workload, status, and updatedAt. Current save code also reads the React Flow viewport but does not persist it.

## 3. Product scope

### In scope
1. Multiple locally stored architecture projects.
2. Project list/dashboard with open/create actions.
3. Rename, duplicate, and delete projects; destructive delete requires confirmation.
4. Autosave editable project state with visible save status.
5. Persist nodes, edges, application name, requirements, architecture notes, and viewport where available.
6. Recover the existing `breachx-design` record as a project without silently deleting or overwriting it.
7. Keep project data isolated by project ID and ensure switching projects does not leak nodes/edges/notes across projects.
8. Keep submitted blueprints locked. Starting a new project must not delete an existing submitted project.
9. Preserve the AI generator handoff and PDF export behavior.
10. Keep a migration/compatibility path for existing singleton data.

### Out of scope
- Supabase cloud project synchronization, authentication changes, team collaboration, and cross-device sync.
- Architecture evaluation/scoring (reserved for the final roadmap phase).
- New AI generation behavior.
- Diagram auto-layout/templates (Phase 5).
- New backend tables unless discovery during implementation proves local storage cannot meet this phase's scope.

## 4. Storage design

Use a versioned local project registry, separate from the existing submission key until migration succeeds.

Suggested types:
- `ArchitectureProject`: `id`, `name`, `applicationDescription`, `nodes`, `edges`, `notes`, optional `workload`, `viewport`, `status` (`draft` | `submitted`), `createdAt`, `updatedAt`.
- Registry schema: `version`, `projects`, `activeProjectId`.
- Keep the existing activity log key unchanged.
- Use stable IDs via `crypto.randomUUID()`.
- Storage reads must handle absent, malformed, and unsupported-version payloads without crashing the app or silently overwriting the raw saved data.
- Migration from `breachx-design` must be idempotent. Only mark the legacy record migrated after the project registry write succeeds.
- Do not use the event/team `blueprints` table for this local workspace feature; its ownership, auth, and submission lock semantics differ from personal project CRUD.

## 5. User experience

- Entry to the designer opens a project dashboard when the user has projects.
- Dashboard shows project name, draft/submitted status, component/connection counts, and last-updated time.
- Actions: New Project, Open, Rename, Duplicate, Delete.
- Delete asks for explicit confirmation and cannot delete the only recoverable legacy data before migration succeeds.
- New project starts with the existing starter graph and default requirements.
- Opening a project loads its own complete state.
- Submitted projects are read-only. Users can duplicate a submitted project to create an editable draft; do not unlock or mutate the submitted original.
- Autosave uses a short debounce and saves the latest project state. Show Saving, Saved, or Save failed; failed saves must leave the user-visible error and must not claim success.
- Manual save/submit remains available and submission validation stays unchanged.
- On storage quota or serialization errors, show a recoverable message and do not clear existing projects.

## 6. Compatibility

- Existing `breachx-design` drafts and submissions are migrated into the registry.
- The AI generator must write into the selected/new draft project rather than overwrite an unrelated project.
- Existing submitted-blueprint behavior remains available; starting a new project must not erase the submitted record.
- Existing `readSubmission` / `writeSubmission` consumers must either be migrated to explicit project APIs or retained as compatibility wrappers targeting the active project. Avoid parallel sources of truth after migration.

## 7. Acceptance criteria

1. A legacy `breachx-design` record appears as a project after migration and remains recoverable if migration fails.
2. Create two projects, edit each differently, switch between them, and confirm no cross-project state leakage.
3. Rename and duplicate work; duplicated projects have a new ID, draft status, and independent graph data.
4. Delete requires confirmation and removes only the selected project.
5. Reloading restores projects and latest saved state.
6. Autosave persists graph changes, text fields, and viewport without requiring manual save.
7. Save failure is visible; the UI does not report a false successful save.
8. Submitted projects cannot be edited or autosaved as drafts; duplication creates an editable draft without changing the submitted source.
9. AI-generated architecture opens in the intended draft project and does not overwrite an unrelated project.
10. PDF export continues to work from the active project.
11. Existing minimum component/connection validation for submission remains unchanged.
12. `npm test` and `npm run build` pass; manual checks above are recorded in the PR.

## 8. Implementation sequence

1. Add versioned project types and storage operations with unit tests.
2. Add dashboard CRUD and active-project selection.
3. Integrate editor autosave and save-status feedback.
4. Integrate generator handoff and submitted-project duplication/locking.
5. Test migration, CRUD isolation, reload recovery, submit behavior, and build.
6. Open a PR; do not merge until local tests/build and manual checks pass.
