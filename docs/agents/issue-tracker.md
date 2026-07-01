# Issue tracker: GitHub Issues

Issues and PRDs for this repo live in **GitHub Issues** on
`rdgallagher/synthfinder`. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body-file <file>` (or
  `--body "..."`). Use the **Agent task** template
  (`.github/ISSUE_TEMPLATE/agent-task.md`): Context / Acceptance Criteria (a
  machine-checkable checklist) / Out of scope / Verification.
- **Read an issue**: `gh issue view <N>` (add `--comments` for discussion).
- **List issues**: `gh issue list` with optional `--label` / `--state` filters.
- **Update / close**: `gh issue edit <N> ...` / `gh issue close <N>`.
- **Comment**: `gh issue comment <N> --body "..."`.
- **Apply labels**: `gh issue edit <N> --add-label <label>` (see `triage-labels.md`).

Pass markdown content directly with literal newlines — do not escape as `\n`.

## Running work with agents

Labelling an issue **`agent-ready`** dispatches the Claude agent to implement it
(`.github/workflows/claude.yml`), which opens a PR. The PR then runs through the
autonomous reviewer↔implementer loop (`.github/workflows/agent-pr-loop.yml`)
until the reviewer approves or the revision cap is hit. **Merges stay manual.**

## When a skill says "publish to the issue tracker"

Create a GitHub issue in this repo with `gh issue create`.

## When a skill says "fetch the relevant ticket"

Call `gh issue view <N>` (add `--comments` if discussion matters).
