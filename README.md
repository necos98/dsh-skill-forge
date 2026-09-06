# dsh-skill-forge

Let the agent distill a finished task into a reusable **project skill**: guided draft + human confirm, then save to the workspace skill root. Per-workspace reusable skills for DSH.

## The idea

You finish a task with the agent (a fixed sequence of steps to reach a goal). Instead of re-writing the prompt in another chat to do the same thing, you ask the agent to forge a skill from it. Next time, the skill is in the session catalog and the agent loads it with the `skill` tool.

## Skill roots (the per-workspace flow)

Forged skills are saved as directory bundles under the **calling workspace**:

```
<projectRoot>/.agents/skills/<name>/SKILL.md
```

This is rank 200 (`project-agents`) of the `dsh-skill-filesystem` provider, discovered in this order:

| Rank | Source | Path |
|---|---|---|
| 100 | `project-dsh` | `<projectRoot>/.dsh/skills` |
| 200 | `project-agents` | `<projectRoot>/.agents/skills` |
| 300 | `custom` | `Config.customSkillDirs` |
| 400 | `user-dsh` | `<dshHome>/skills` |
| 500 | `user-agents` | `<agentsHome>/skills` |

Why `.agents/skills` and not `.dsh/skills`: it is the shared agent-config root (also picked up by other agent tools), it is already the convention in this repo family, and it keeps forged skills visible next to hand-written ones. Project root = nearest ancestor containing `.git`, else the session cwd. New/renamed/deleted skills reach the next model step without a restart (the provider watches the roots).

A skill file starts with YAML frontmatter (`name` + `description` required; `whenToUse`, `disable-model-invocation`, `user-invocable` optional) followed by the markdown instructions. Skill names are kebab-case (`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`). An invalid file is silently skipped by the provider — so the forge validates BEFORE writing.

## Flow

1. Finish the task with the agent.
2. Ask: forge a skill from this task.
3. The agent drafts with `skill_forge_draft` (validates + previews the SKILL.md, writes nothing).
4. You confirm (or ask for changes).
5. The agent saves with `skill_forge_save` to `<projectRoot>/.agents/skills/<name>/SKILL.md`.
6. From the next step the skill is in the session catalog — reusable in any later chat on this workspace.

You propose, the human publishes: nothing is written without explicit confirmation. Saving over an existing name needs `overwrite: true`.

## Tools

- `skill_forge_draft` — validate a draft, return the SKILL.md preview (no write).
- `skill_forge_save` — save a human-confirmed draft to the calling workspace skill root.
- `skill_forge_list` — list forged skills in the calling workspace root.
- `skill_forge_read` — read one forged SKILL.md from the calling workspace root.

Every response starts with `[workspace <id>]` so the agent can verify it acted in the intended project. A session with no workspace gets a `no-workspace` error instead of a write.

## Development

```sh
npm test             # unit tests (node --test)
npm run check        # syntax-check lib/test/scripts
```

## Install (from the profile that runs the web app)

```sh
dsh plugin add <path-to-this-folder>
```

## License

MIT
