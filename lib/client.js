// dsh-skill-forge — browser half (web).
//
// Minimal client module: reads the dsh-skill-forge settings namespace
// (registered by the host half) and renders one row in the General settings
// with a toggle and the skill-root field.
//
// The factory is CommonJS-style on purpose: the client bundle is loaded by
// window.__ModuleLoader__ and gets react through require(), not import.
// No build step: this file is served as-is.

window.__ModuleLoader__.load({
  id: "dsh-skill-forge",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");

    const NS = "dsh-skill-forge";
    const DEFAULT_CONFIG = { enabled: true, defaultSkillRoot: ".agents/skills" };

    function ForgeRow({ scope }) {
      if (scope === undefined) return null;
      const snapshot = React.useSyncExternalStore(
        (listener) => scope.subscribe(listener),
        () => scope.getSnapshot()
      );
      const v = snapshot.value ?? {};
      const enabled = v.enabled !== false;
      const root = typeof v.defaultSkillRoot === "string" ? v.defaultSkillRoot : DEFAULT_CONFIG.defaultSkillRoot;
      const set = (field, value) => { scope.set(field, value).catch(() => {}); };
      return React.createElement("div", null,
        React.createElement("div", null, "Skill forge " + (enabled ? "ON" : "OFF")),
        React.createElement("div", null, "Skill root: " + root),
        React.createElement("button", { onClick: () => set("enabled", !enabled) }, enabled ? "Disable" : "Enable")
      );
    }

    return { ForgeRow };
  },
});