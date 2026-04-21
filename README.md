# endgame_grocery

## Overview

TODO: Describe this project.

## Getting Started

TODO: Add setup instructions.

## AI Workflow

This project includes the persistent planner/implementer/reviewer workflow with file-based coordination, plus the PO orchestration layer.
Manual and auto are two runtime modes for the same scaffold: they use the same generated files, task board, and review gate. Fewer role sessions means less coordination overhead and lower token cost.

### Runtime modes

- Manual mode: start the planner, implementer, and reviewer in separate terminals, then drive each session yourself with the documented text commands.
- Auto mode: run `aide po` to start the PO session, which uses MCP tools to coordinate the post-planning implementer/reviewer workflow for you.

### Concepts

**Cycle** — a unit of work on a feature branch. One cycle = one branch = one PR.

**Roles and file ownership:**

| Role | Reads | Writes |
|------|-------|--------|
| PO | `.ai/TASKS.md`, `.ai/PLAN.md`, `.ai/REVIEW.md`, `.ai/prompts/po.md` | MCP session commands via `aide po` |
| Planner | `ROADMAP.md` | `.ai/PLAN.md`, `.ai/TASKS.md` |
| Implementer | `.ai/PLAN.md`, `.ai/REVIEW.md` | source code, `.ai/TASKS.md` |
| Reviewer | `.ai/PLAN.md`, commits | `.ai/REVIEW.md`, `.ai/TASKS.md` |

**Status flow:**

```text
in_planning → ready_for_implement → in_implementation → ready_for_review → in_review → ready_to_commit → done
                                          ↑                                     |
                                          └──── changes_requested ◄─────────────┘
```

### Start a new development cycle

```bash
# Edit ROADMAP.md with your goals first, then:
aide cycle start feature/<scope>
```

### Start persistent role sessions (manual mode)

```bash
aide plan          # terminal 1
aide implement     # terminal 2
aide review        # terminal 3
```

Launch each role once, then keep those sessions open for the rest of the cycle.

Role launchers read default agent/model settings from `.ai/config.json`.
To override, pass the agent first, then any CLI flags.
Example: `aide review claude --model sonnet`
Claude starts interactively by default, and the Codex launcher uses interactive `codex` mode so the session stays open for role commands.

### Start the PO orchestrator (auto mode)

```bash
aide po
```

The PO session drives the post-planning task board flow through the `aide` MCP server.
By default, `aide po` launches Claude with `--model haiku`, and `aide po codex` launches Codex with `-m gpt-5.4-mini`. `.ai/config.json` can override those defaults, and an explicit CLI `--model` or `-m` flag takes precedence.
If no tasks are in `ready_for_implement` or later, run the planner first.
The MCP server appends structured debug logs to `.ai/mcp-server.log`, and the scaffold gitignore excludes that file.

### Drive work inside the existing sessions

```text
planner> start_plan
implementer> next_task T-001
reviewer> next_task T-001
implementer> commit_task T-001
implementer> rework_task T-001
aide cycle end 0.7.0
```

Cross-platform CLI equivalents:
`aide cycle end [VERSION]` closes the cycle outside the persistent role session, and `aide pr [--dry-run]` creates or updates the branch PR.

**Planner commands:**

Before `start_plan`, freeform conversation with the planner is the roadmap-refinement phase. Use it to sharpen scope, acceptance criteria, constraints, and trade-offs directly in `ROADMAP.md`. `start_plan` is the explicit handoff into formal planning.

| Command | Description |
|---------|-------------|
| `start_plan` | Read `ROADMAP.md`, write `.ai/PLAN.md` and `.ai/TASKS.md` |
| `rework_plan [TASK_ID]` | Revisit the plan when scope or approach changes |

**Implementer commands:**

| Command | Description |
|---------|-------------|
| `next_task [TASK_ID]` | Pick up the next `ready_for_implement` task |
| `commit_task [TASK_ID]` | Turn a `ready_to_commit` task into one clean final commit, including task-specific `.ai/` artifacts |
| `rework_task [TASK_ID]` | Address `changes_requested` findings from `.ai/REVIEW.md` |
| `aide cycle end [VERSION]` | Close the cycle after all tasks reach `done`, committing remaining `.ai/` artifacts with a `Release-As:` footer |
| `status_cycle [TASK_ID]` | Show task status and recommended next action |

**Reviewer commands:**

| Command | Description |
|---------|-------------|
| `next_task [TASK_ID]` | Pick up the next `ready_for_review` task and run review plus verification |
| `status_cycle [TASK_ID]` | Show task status and recommended next action |

### File map

| File | Purpose | Tracked |
|------|---------|---------|
| `.ai/PLAN.md` | Current plan | yes |
| `.ai/TASKS.md` | Task board with status | yes |
| `.ai/prompts/po.md` | PO orchestration prompt for auto mode | yes |
| `.ai/REVIEW.md` | Review findings | yes (tracked cycle log) |
| `.ai/HANDOFF.md` | Runtime handoff log | yes (tracked cycle log) |
| `.ai/config.json` | Per-role launch defaults | yes |
| `ROADMAP.md` | Cycle goals (edit before planning) | yes |
| `AGENTS.md` | Project-specific and workflow-managed agent rules | yes |
| `CLAUDE.md` | Agent instruction entry point (`@AGENTS.md`) | yes |
| `aide po` | Launch the PO orchestration session | yes |

### Create a PR

```bash
aide pr
```

Full workflow details and session recovery rules are in `AGENTS.md`.
