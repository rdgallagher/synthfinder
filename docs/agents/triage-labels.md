# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles
to the actual Linear labels used in this repo. These are applied via the `labels`
field on `mcp__linear-server__save_issue`, on top of Linear's native workflow states.

| Role in mattpocock/skills | Linear label      | Meaning                                  |
| ------------------------- | ----------------- | ---------------------------------------- |
| `needs-triage`            | `needs-triage`    | Maintainer needs to evaluate this issue  |
| `needs-info`              | `needs-info`      | Waiting on reporter for more information |
| `ready-for-agent`         | `ready-for-agent` | Fully specified, ready for an AFK agent  |
| `ready-for-human`         | `ready-for-human` | Requires human implementation            |
| `wontfix`                 | `wontfix`         | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the
corresponding Linear label from this table. Linear creates a label on first use, so
no pre-setup is required. Edit the right-hand column if your vocabulary changes.
