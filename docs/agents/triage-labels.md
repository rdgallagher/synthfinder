# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles
to the actual GitHub labels used in this repo. Apply them with
`gh issue edit <N> --add-label <label>`.

| Role in mattpocock/skills | GitHub label      | Meaning                                  |
| ------------------------- | ----------------- | ---------------------------------------- |
| `needs-triage`            | `needs-triage`    | Maintainer needs to evaluate this issue  |
| `needs-info`              | `needs-info`      | Waiting on reporter for more information |
| `ready-for-agent`         | `agent-ready`     | Fully specified — dispatches the agent   |
| `ready-for-human`         | `ready-for-human` | Requires human implementation            |
| `wontfix`                 | `wontfix`         | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the
corresponding GitHub label from this table. Note that `agent-ready` is also the
**dispatch trigger**: applying it launches the Claude agent on the issue (see
`issue-tracker.md`). Unlike Linear, GitHub does **not** auto-create labels — a
label must exist in the repo before it can be applied.
