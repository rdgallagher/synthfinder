# Issue tracker: Linear

Issues and PRDs for this repo live in **Linear**, in the **SynthFinder** project
(team **Rdgallagher**, issue prefix `RDG-`). Use the `linear-server` MCP tools for
all operations — not the `gh` CLI.

## Conventions

- **Create an issue**: `mcp__linear-server__save_issue` with `team: "Rdgallagher"`,
  `project: "SynthFinder"`, a `title`, a markdown `description`, and a `state`
  (Backlog / Todo / In Progress / In Review / Done / Canceled).
- **Update an issue**: `mcp__linear-server__save_issue` with the issue `id`
  (e.g. `RDG-12`) and the fields to change (e.g. `state: "Done"`).
- **Read an issue**: `mcp__linear-server__get_issue` for the full description;
  `mcp__linear-server__list_comments` for discussion.
- **List issues**: `mcp__linear-server__list_issues` with `project: "SynthFinder"`
  and optional `state` / `label` filters.
- **Comment**: `mcp__linear-server__save_comment` with `issueId` and a markdown `body`.
- **Apply labels**: pass `labels: [...]` to `save_issue` (see `triage-labels.md`).

Pass markdown content directly with literal newlines — do not escape as `\n`.

## When a skill says "publish to the issue tracker"

Create a Linear issue in the SynthFinder project.

## When a skill says "fetch the relevant ticket"

Call `get_issue` with the `RDG-` identifier (and `list_comments` if discussion matters).
