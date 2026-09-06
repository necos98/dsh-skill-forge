// dsh-skill-forge — agent tool definitions (pure).
//
// Four registry-ready tools bound to a runtime at apply() time:
//   skill_forge_draft — validate a draft, return the SKILL.md preview (no write).
//   skill_forge_save  — validate + write <root>/<name>/SKILL.md (human-confirmed).
//   skill_forge_list  — list forged skills in the calling workspace root.
//   skill_forge_read  — read one forged SKILL.md from the calling workspace root.
// Every response is prefixed with [workspace <id>] so the agent can verify
// it acted in the intended project. Tools throw Error(message) on domain
// errors; the tool runtime reports it.

import { validateDraft, renderSkillFile, skillPaths } from "./skillfile.js";
import { resolveSessionWorkspace } from "./workspace.js";

// Short English descriptions — they ride every agent request.
export const TOOL_NAMES = [
  "skill_forge_draft",
  "skill_forge_save",
  "skill_forge_list",
  "skill_forge_read",
];

function compileParameters(params) {
  const properties = {};
  const required = [];
  for (const [name, spec] of Object.entries(params)) {
    properties[name] = { type: spec.type, description: String(spec.description ?? "") };
    if (Array.isArray(spec.enum)) properties[name].enum = spec.enum;
    if (spec.required) required.push(name);
  }
  return { type: "object", properties, required, additionalProperties: false };
}

// The runtime carries { fs, workspaceRegistry?, sessionQuery?, defaultSkillRoot }.
// fs is the host filesystem service when available; otherwise the tools
// degrade to draft-only (save/list/read report the missing service).
function tag(workspaceId, text) {
  return "[workspace " + workspaceId + "]\n" + text;
}

function fsOf(runtime) {
  const fs = runtime ? runtime.fs : undefined;
  if (!fs) throw new Error("no-fs: no filesystem service is mounted, so skills cannot be saved here.");
  return fs;
}

async function fsExists(fs, path) {
  try {
    const st = await fs.stat(path);
    return !!st;
  } catch {
    return false;
  }
}

export function makeToolDefinitions(runtime) {
  const specs = [
    {
      name: "skill_forge_draft",
      description: "Validate a reusable-skill draft and preview the SKILL.md (no file is written). Confirm with the human before saving.",
      parameters: compileParameters({
        name: { type: "string", description: "Skill name, kebab-case", required: true },
        description: { type: "string", description: "One-line routing description", required: true },
        whenToUse: { type: "string", description: "When the agent should load this skill" },
        body: { type: "string", description: "Reusable markdown instructions (generalize the task, parametrize specifics)", required: true },
        modelInvocable: { type: "boolean", description: "Show in the model catalog (default true)" },
        userInvocable: { type: "boolean", description: "Allow /name invocation (default true)" },
      }),
      execute: async (args, exec) => {
        const ctx = await resolveSessionWorkspace(runtime, exec);
        const draft = validateDraft(args ?? {});
        const paths = skillPaths(ctx.workspaceRoot, runtime.defaultSkillRoot, draft.name);
        const preview = renderSkillFile(draft);
        return tag(ctx.workspaceId, "Draft OK — NOT saved. Show this preview to the human and ask for confirmation before skill_forge_save.\n\nTarget: " + paths.file + "\n\n" + preview);
      },
    },
    {
      name: "skill_forge_save",
      description: "Save a human-confirmed skill draft to the calling workspace skill root. Fails if the skill already exists (use overwrite).",
      parameters: compileParameters({
        name: { type: "string", description: "Skill name, kebab-case", required: true },
        description: { type: "string", description: "One-line routing description", required: true },
        whenToUse: { type: "string", description: "When the agent should load this skill" },
        body: { type: "string", description: "Reusable markdown instructions", required: true },
        modelInvocable: { type: "boolean", description: "Show in the model catalog (default true)" },
        userInvocable: { type: "boolean", description: "Allow /name invocation (default true)" },
        overwrite: { type: "boolean", description: "Replace an existing skill with the same name" },
      }),
      execute: async (args, exec) => {
        const ctx = await resolveSessionWorkspace(runtime, exec);
        const { overwrite, ...draftArgs } = args ?? {};
        const draft = validateDraft(draftArgs);
        const paths = skillPaths(ctx.workspaceRoot, runtime.defaultSkillRoot, draft.name);
        const fs = fsOf(runtime);
        if (!overwrite && (await fsExists(fs, paths.file))) {
          throw new Error('Skill "' + draft.name + '" already exists at ' + paths.file + '. Ask the human, then retry with overwrite true to replace it.');
        }
        await fs.mkdir(paths.dir, { recursive: true });
        await fs.writeFile(paths.file, renderSkillFile(draft), "utf8");
        return tag(ctx.workspaceId, 'Saved skill "' + draft.name + '" to ' + paths.file + '. It appears in the session catalog from the next step; load it with the skill tool to verify.');
      },
    },
    {
      name: "skill_forge_list",
      description: "List forged skills saved in the calling workspace skill root.",
      parameters: compileParameters({}),
      execute: async (args, exec) => {
        const ctx = await resolveSessionWorkspace(runtime, exec);
        const fs = fsOf(runtime);
        const root = String(ctx.workspaceRoot).replace(/\/+$/, "") + "/" + String(runtime.defaultSkillRoot).replace(/^\/+|\/+$/g, "");
        let entries = [];
        try {
          entries = await fs.readdir(root);
        } catch {
          return tag(ctx.workspaceId, "No forged skills yet under " + root + ".");
        }
        const names = entries.map((e) => (typeof e === "string" ? e : e.name)).filter(Boolean).sort();
        if (names.length === 0) return tag(ctx.workspaceId, "No forged skills yet under " + root + ".");
        return tag(ctx.workspaceId, "Forged skills under " + root + ":\n" + names.map((n) => "- " + n).join("\n"));
      },
    },
    {
      name: "skill_forge_read",
      description: "Read one forged SKILL.md from the calling workspace skill root.",
      parameters: compileParameters({
        name: { type: "string", description: "Skill name, kebab-case", required: true },
      }),
      execute: async (args, exec) => {
        const ctx = await resolveSessionWorkspace(runtime, exec);
        const paths = skillPaths(ctx.workspaceRoot, runtime.defaultSkillRoot, String((args ?? {}).name ?? ""));
        const fs = fsOf(runtime);
        let text = null;
        try {
          text = await fs.readFile(paths.file, "utf8");
        } catch {
          text = null;
        }
        if (text === null || text === undefined) {
          throw new Error('Skill "' + args.name + '" not found at ' + paths.file + '.');
        }
        return tag(ctx.workspaceId, "SKILL.md for \"" + args.name + "\" (" + paths.file + "):\n\n" + String(text));
      },
    },
  ];
  for (const spec of specs) {
    const execute = spec.execute;
    spec.execute = async (args, exec) => {
      try {
        return await execute(args ?? {}, exec);
      } catch (error) {
        throw new Error(error && error.message ? error.message : String(error));
      }
    };
    spec.output = {
      schema: { type: "string" },
      render: (_args, value) => [{ type: "text", text: String(value) }],
    };
  }
  return specs;
}
