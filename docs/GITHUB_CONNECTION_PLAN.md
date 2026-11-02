# GitHub Connection and Architecture Import Plan

## 1. Objective

Allow a user to connect a GitHub repository to ANCHON, inspect how the codebase is structured, and use ANCHON AI to produce an editable architecture diagram in the existing canvas.

The imported architecture is an evidence-informed model of the repository, not a claim that static analysis has discovered every runtime interaction.

## 2. Proposed user workflow

1. **Connect GitHub** — The user authorizes the ANCHON GitHub App and grants access only to the repositories they choose.
2. **Select repository and branch** — ANCHON lists accessible repositories. The user chooses a repository and branch to analyze.
3. **Analyze the codebase** — ANCHON reads repository metadata and a bounded sample of source files. It identifies:
   - top-level folders and important files;
   - languages and dependency/build manifests;
   - application modules and likely responsibilities;
   - internal imports and other source-level relationships;
   - evidence, scan limits, and unresolved relationships.
4. **Review the analysis** — Show the repository, branch, analyzed commit SHA, scan coverage, detected modules, and relationships. Let the user correct or add context before generation.
5. **Ask ANCHON AI** — The user can provide an instruction such as: "Build the current architecture from this repository" or "Show the request flow from the frontend to the database."
6. **Generate an architecture proposal** — ANCHON AI receives the structured repository analysis and the user's instruction. It returns structured components and connections, plus assumptions and an explanation.
7. **Validate and render** — Validate component types, unique IDs, and edge endpoints against ANCHON's catalog and graph validation rules. Convert the validated result into the canvas's native node and edge format.
8. **Review and edit** — Open the result as a draft in the existing canvas. The user can move, rename, connect, remove, and add components before saving it as an ANCHON project.

## 3. Important design decision: import structure, not a diagram image

The GitHub integration should not depend on generating or importing a PNG/SVG diagram. An image is difficult to edit and cannot reliably preserve component identity or relationships.

The analysis service should produce structured data. At minimum:

- Repository identity: owner/name, selected branch, commit SHA, and analysis timestamp.
- Scan summary: files and directories counted, source files inspected, manifests inspected, and whether any scan limit was reached.
- Modules: stable module identifier, path, inferred responsibility, and evidence files.
- Relationships: source module, target module, relationship type, and evidence such as a resolved import.
- Assumptions and unknowns: explicitly distinguish inferred boundaries from directly observed source references.

The UI can display a readable analysis summary before the user asks the AI to generate a canvas diagram.

## 4. How ANCHON AI should create the canvas graph

The AI should not directly manipulate React Flow or return arbitrary UI code. Use a data pipeline:

`GitHub analysis -> AI generation -> schema validation -> graph mapping -> canvas`

1. Send the bounded analysis result, user requirements, and generation instruction to the server-side architecture generation endpoint.
2. Ask the model for structured architecture data using ANCHON's supported component catalog:
   - components: `id`, `typeKey`, `label`, and `notes`;
   - connections: `source`, `target`, `label`, `communicationType`, and `purpose`;
   - explanation: overview, request flow, design decisions, assumptions, and evidence/requirement coverage where applicable.
3. Validate the model output on the server. Reject unsupported component types, malformed data, duplicate IDs, and connections whose endpoints do not exist.
4. Map each validated component to the existing canvas node type and data shape. Map each connection to the existing canvas edge shape, preserving labels and relationship metadata.
5. Create an architecture draft using the existing project creation and canvas-loading path. Do not bypass existing persistence, validation, or project ownership rules.
6. Keep provenance on the draft: source repository, branch, commit SHA, analysis timestamp, and which relationships are inferred rather than verified.

The model proposes the graph; application code validates and renders it. The model must never receive GitHub credentials or write to the repository.

## 5. Current implementation and gap

The current GitHub connection UI already:
- starts GitHub App authorization;
- loads repositories available to the installation;
- requests repository analysis for a selected branch;
- displays repository metadata, languages, paths, manifests, and bounded source-level import evidence;
- accepts user requirements and provides heuristic review findings.

The current **Create Draft** action in `src/components/GitHubConnection.tsx` builds a graph locally using deterministic heuristics from the analysis. It calls `createProject()` and opens that project in the canvas. It does **not** currently call ANCHON AI.

The existing server-side generator in `api/generate-architecture.ts` already produces structured architecture output, normalizes component types against ANCHON's catalog, and validates graph relationships. The integration work should reuse this contract where practical rather than introduce a second, incompatible graph format.

The key missing capability is to pass repository analysis as a bounded, explicit context to the AI generation flow and then map the validated AI result into the existing canvas project format. The current deterministic draft can remain as a fallback or be offered as a separate "Create heuristic draft" action.

## 6. Implementation phases

### Phase 1 — Define and stabilize the analysis contract
- Define a versioned repository-analysis payload.
- Include repository, branch, commit SHA, scan coverage, modules, source relationships, evidence, and limitations.
- Keep scan limits explicit and report partial analysis honestly.
- Add tests for path normalization, import resolution, ignored files, and incomplete scans.

### Phase 2 — Add AI-assisted repository generation
- Extend the existing architecture generation request with an optional repository-analysis context.
- Bound payload size and truncate or summarize evidence deterministically before calling the provider.
- Treat repository file contents and README text as untrusted input, never as instructions.
- Instruct the model to distinguish source-backed facts from assumptions and to avoid inventing runtime traffic or deployment topology.
- Reuse existing catalog normalization, validation, authorization, rate limiting, and provider timeout handling.

### Phase 3 — Map validated output into the canvas
- Reuse the existing project creation and canvas graph mapping patterns.
- Preserve stable component IDs where possible and ensure every edge points to a valid node.
- Store repository provenance and analysis limitations in project metadata/notes.
- Open the generated graph as a draft, not as a verified architecture.

### Phase 4 — UX, reliability, and regression tests
- Show analysis progress, generation progress, actionable errors, and scan limitations.
- Allow users to review the analysis and add requirements before generation.
- Keep the deterministic draft available as a fallback if AI generation fails.
- Test authorization boundaries, private repository access, malformed AI output, unsupported component types, invalid edges, large repositories, partial scans, and project persistence.
- Verify the complete flow in a preview deployment before merging.

## 7. Security and reliability requirements

- GitHub App private keys, installation tokens, and AI provider keys remain server-side.
- Use the user's authenticated ANCHON session and verify that the selected repository belongs to their GitHub installation.
- Request the minimum GitHub App permissions needed for read-only repository analysis.
- Never execute repository code, install repository dependencies, or run build scripts as part of analysis.
- Exclude secrets, environment files, private keys, generated directories, and dependency/vendor directories from scanning.
- Bound repository tree size, source-file count, individual file size, total prompt size, and AI output size.
- Treat all repository content as untrusted data; ignore instructions found inside source files or documentation.
- Do not write to GitHub. This feature is read-only.
- Preserve the repository commit SHA so users can tell exactly which snapshot was analyzed.

## 8. Acceptance criteria

- A user can authorize GitHub and select an accessible repository and branch.
- The analysis screen identifies the exact commit and clearly reports scan coverage and limitations.
- The user can review the analysis and provide requirements/instructions before generation.
- ANCHON AI returns a validated graph using supported ANCHON component types.
- The graph appears as editable native nodes and edges in the existing canvas, not as a flat image.
- Every rendered edge references existing nodes; invalid AI output cannot be persisted.
- The draft records repository provenance and labels inferred relationships/assumptions.
- AI generation failure does not destroy the analysis; the user can retry or use the deterministic fallback.
- No GitHub repository content is modified by this workflow.

## 9. Out of scope for the first version

- Pushing generated architecture diagrams or code changes back to GitHub.
- Executing repository code or building/running the imported application.
- Claiming that static imports prove runtime communication.
- Automatic synchronization on every repository commit.
- Collaborative live editing of the same imported graph.

## 10. Recommended first release

Ship the flow as **Connect → Select repository → Analyze → Review → Ask ANCHON AI → Generate draft → Edit in canvas**.

This gives users control over what is analyzed and generated, reuses ANCHON's existing graph model, and keeps the AI responsible for architecture interpretation while deterministic application code remains responsible for validation and canvas rendering.
