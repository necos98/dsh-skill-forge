// dsh-skill-forge — pure config domain.
//
// resolveConfig, forgeSchema and settingsNamespace live here (not in
// index.js) so unit tests and evals can import them without booting Cordis.
// This module must stay free of `ctx` and of package imports.

/** Where forged skills are saved, relative to the workspace root. */
export const DEFAULT_SKILL_ROOT = ".agents/skills";

/** Accepted config keys, for the unknown-key guard. */
export const CONFIG_KEYS = ["order", "enabled", "allowCommand", "defaultSkillRoot"];

/** Settings namespace shared with the web client (lib/client.js). */
export const NS = "dsh-skill-forge";

/**
 * settingsNamespace() in @deepseek-ai/dsh-settings is only a branded string
 * with a validation pattern; inlined so the host module stays free of imports
 * that the profile node_modules might not resolve.
 */
export function settingsNamespace(value) {
  if (!/^[a-z][a-z0-9-]*$/.test(value)) {
    throw new TypeError(
      'settings namespace "' + value + '" must match /^[a-z][a-z0-9-]*$/'
    );
  }
  return value;
}

/**
 * Validate deployment-owned config. Missing, mistyped, or unknown fields fail
 * at plugin load rather than being ignored.
 * @param config Raw plugin config.
 * @returns A detached validated config with defaults applied.
 */
export function resolveConfig(config) {
  const order = config.order ?? 50;
  if (typeof order !== "number" || !Number.isFinite(order)) {
    throw new Error("ForgeConfig needs a finite number `order`");
  }
  const enabled = config.enabled ?? false;
  if (typeof enabled !== "boolean") {
    throw new Error("ForgeConfig needs a boolean `enabled`");
  }
  const allowCommand = config.allowCommand ?? true;
  if (typeof allowCommand !== "boolean") {
    throw new Error("ForgeConfig needs a boolean `allowCommand`");
  }
  const defaultSkillRoot = config.defaultSkillRoot ?? DEFAULT_SKILL_ROOT;
  if (typeof defaultSkillRoot !== "string" || defaultSkillRoot.trim() === "") {
    throw new Error("ForgeConfig needs a non-empty string `defaultSkillRoot`");
  }
  if (defaultSkillRoot.includes("..")) {
    throw new Error("ForgeConfig `defaultSkillRoot` must stay inside the workspace (no ..)");
  }
  const unknown = Object.keys(config).filter((key) => !CONFIG_KEYS.includes(key));
  if (unknown.length > 0) {
    throw new Error(
      "ForgeConfig has unknown key(s) " + unknown.join(", ") +
        " — config is { order, enabled, allowCommand, defaultSkillRoot }"
    );
  }
  return { order, enabled, allowCommand, defaultSkillRoot };
}

// Schema of the settings namespace, written as a callable function
// (schemastery schemas are invoked as functions): settings.register(ns, schema)
// resolves the value with schema(section), so a function with toJSON is enough
// and needs no @deepseek-ai/schemastery import.
export function forgeSchema(section) {
  const value = section ?? {};
  return {
    enabled: typeof value.enabled === "boolean" ? value.enabled : true,
    defaultSkillRoot:
      typeof value.defaultSkillRoot === "string" && value.defaultSkillRoot.trim() !== ""
        ? value.defaultSkillRoot
        : DEFAULT_SKILL_ROOT,
  };
}
forgeSchema.toJSON = () => ({
  type: "object",
  properties: {
    enabled: { type: "boolean" },
    defaultSkillRoot: { type: "string" },
  },
});
