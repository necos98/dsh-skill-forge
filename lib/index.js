// dsh-skill-forge — host node (Cordis wiring only).
//
// Registers: the /skill-forge command, the English system-prompt section
// (distillation policy, policy band), the settings namespace for the web
// client, and the four skill_forge_* agent tools (draft|save|list|read).
// Domain logic lives in lib/skillfile.js, lib/workspace.js, lib/tools.js
// and lib/handlers.js so it is unit-testable without booting DSH.
// @module dsh-skill-forge

import { DEFAULT_SKILL_ROOT, NS, resolveConfig, settingsNamespace, forgeSchema } from "./config.js";
import { DEFAULT_SECTION, createCommandHandler, createPolicyText } from "./handlers.js";
import { makeToolDefinitions } from "./tools.js";

/** Cordis plugin name. */
export const name = "dsh-skill-forge";

/** Required services: the prompt registry owns the section registration. */
export const inject = ["systemPrompt"];

/**
 * Plugin body (host).
 * @param ctx - a context carrying the prompt registry.
 * @param config - the validated forge guidance.
 */
export function apply(ctx, config) {
  const resolved = resolveConfig(config);
  const state = { enabled: resolved.enabled, section: DEFAULT_SECTION };
  const runtime = {
    fs: undefined,
    workspaceRegistry: undefined,
    sessionQuery: undefined,
    defaultSkillRoot: resolved.defaultSkillRoot ?? DEFAULT_SKILL_ROOT,
  };

  // 0) Optional host services: filesystem for saving, workspace registry
  //    + session lineage for calling-session resolution. Without them
  //    the plugin still registers the section and command; tools fail
  //    fast with a clear message.
  ctx.inject(["fs"], (fsCtx) => {
    const fs = fsCtx.get ? fsCtx.get("fs") : fsCtx.fs;
    if (fs) runtime.fs = fs;
  });
  ctx.inject(["workspaceRegistry"], (registryCtx) => {
    const registry = registryCtx.get("workspaceRegistry");
    if (registry) runtime.workspaceRegistry = registry;
  });
  ctx.inject(["sessionQuery"], (queryCtx) => {
    const query = queryCtx.get("sessionQuery");
    if (query) runtime.sessionQuery = query;
  });

  // 1) System-prompt section (policy band).
  ctx.systemPrompt.section({
    name: "skill-forge:policy",
    order: resolved.order,
    text: createPolicyText(state),
  });

  // 2) Settings namespace for the web client half.
  ctx.inject(["settings"], (settingsCtx) => {
    settingsCtx.settings.register(settingsNamespace(NS), forgeSchema);
  });

  // 3) Lifecycle hooks.
  ctx.on("ready", () => {
    console.log("[dsh-skill-forge] active (enabled=" + state.enabled + ", order=" + resolved.order + ")");
  });
  ctx.on("dispose", () => {
    console.log("[dsh-skill-forge] removed");
  });

  // 4) /skill-forge command through optional injection.
  if (resolved.allowCommand) {
    ctx.inject(["commands"], (commandCtx) => {
      commandCtx.commands.register({
        name: "skill-forge",
        description: "Forge reusable project skills: ask the agent to distill this task",
        input: { hint: "[on|off|status|help]" },
        handler: createCommandHandler(state),
      });
    });
  }

  // 5) Agent tools through optional injection: a composition without
  //    tools still gets the command and the prompt section.
  ctx.inject(["tools"], (toolsCtx) => {
    for (const definition of makeToolDefinitions(runtime)) {
      const dispose = toolsCtx.tools.register(definition);
      ctx.effect(() => dispose, "dsh-skill-forge: tool " + definition.name);
    }
  });
}

export { DEFAULT_SKILL_ROOT, NS, resolveConfig, settingsNamespace, forgeSchema };
