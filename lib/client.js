// dsh-skill-forge — browser half (web).
//
// Minimal client module: reads the dsh-skill-forge settings namespace
// (registered by the host half) and renders one row in the General settings
// with a toggle and the skill-root field.
//
// The factory is CommonJS-style on purpose: the client bundle is loaded by
// window.__ModuleLoader__ and gets react through require(), not import.
// No build step: this file is served as-is.
//
// Client-plugin protocol (same as dsh-sound-notify / dsh-wiki): the factory
// MUST return a Cordis plugin — an object with an `apply(ctx)` method plus
// `inject`. Returning a bare component object (e.g. `{ ForgeRow }`) fails the
// web loader with: invalid plugin, expect function or object with an "apply"
// method, received object.

window.__ModuleLoader__.load({
  id: "dsh-skill-forge",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");

    const NS = "dsh-skill-forge";
    const DEFAULT_CONFIG = { enabled: true, defaultSkillRoot: ".agents/skills" };

    // #region settings row (settings.general.item)
    function ForgeRow({ scope, t }) {
      if (scope === undefined) return null;
      const text = typeof t === "function" ? t : (key) => key;
      const snapshot = React.useSyncExternalStore(
        (listener) => scope.subscribe(listener),
        () => scope.getSnapshot()
      );
      const v = snapshot.value ?? {};
      const enabled = v.enabled !== false;
      const root =
        typeof v.defaultSkillRoot === "string" && v.defaultSkillRoot.trim() !== ""
          ? v.defaultSkillRoot
          : DEFAULT_CONFIG.defaultSkillRoot;
      const set = (field, value) => { scope.set(field, value).catch(() => {}); };
      return React.createElement(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: "16px 0",
            borderBottom: "1px solid var(--dsw-alias-border-l2)",
          },
        },
        React.createElement(
          "div",
          { style: { display: "flex", alignItems: "center", gap: 8 } },
          React.createElement(
            "div",
            { style: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4, paddingRight: 12 } },
            React.createElement(
              "div",
              { style: { color: "var(--dsw-alias-label-primary)", fontSize: 14, lineHeight: "22px" } },
              text("row.title")
            ),
            React.createElement(
              "div",
              { style: { color: "var(--dsw-alias-label-tertiary)", fontSize: 12, lineHeight: "18px" } },
              text("row.desc")
            )
          ),
          React.createElement(
            "button",
            {
              onClick: () => set("enabled", !enabled),
              style: {
                border: "1px solid var(--dsw-alias-border-l2)",
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                background: enabled
                  ? "var(--dsw-alias-button-primary-fill)"
                  : "var(--dsw-alias-bg-layer-1)",
                color: enabled
                  ? "var(--dsw-alias-label-primary-inverted)"
                  : "var(--dsw-alias-label-primary)",
                fontFamily: "var(--dsw-font-family)",
              },
            },
            enabled ? "Disable" : "Enable"
          )
        ),
        React.createElement(
          "div",
          { style: { display: "flex", gap: 8, alignItems: "center" } },
          React.createElement(
            "span",
            { style: { color: "var(--dsw-alias-label-secondary)", fontSize: 12, lineHeight: "18px", whiteSpace: "nowrap" } },
            text("root.label")
          ),
          React.createElement("input", {
            value: root,
            onChange: (event) => set("defaultSkillRoot", event.target.value),
            spellCheck: false,
            style: {
              background: "var(--dsw-alias-bg-layer-1)",
              color: "var(--dsw-alias-label-primary)",
              border: "1px solid var(--dsw-alias-border-l2)",
              borderRadius: 8,
              padding: "6px 10px",
              fontSize: 13,
              minWidth: 140,
              fontFamily: "var(--dsw-font-family)",
            },
          })
        )
      );
    }
    // #endregion

    // #region plugin body
    const inject = ["slots", "locale", "settingsScope"];

    function apply(ctx) {
      // 1) Configuration: sync the config with the host namespace.
      const scope = ctx.settingsScope.bind({ namespace: NS });
      const sync = () => {};
      sync();
      const unsubScope = scope.subscribe(sync);
      ctx.effect(() => unsubScope, "dsh-skill-forge: settings sync");

      // 2) i18n dictionaries.
      const locale = ctx.get("locale");
      if (locale !== undefined) {
        ctx.effect(
          () =>
            locale.register(NS, {
              en: {
                "row.title": "Skill forge",
                "row.desc": "Distill finished tasks into reusable project skills: draft, human confirm, save.",
                "root.label": "Skill root",
              },
            }),
          "dsh-skill-forge: dictionaries"
        );
      }

      // 3) UI slot: one row in General settings.
      const slots = ctx.get("slots");
      if (slots !== undefined) {
        slots.inject("settings.general.item", () =>
          slots.register(
            {
              name: "settings.general.item",
              id: "dsh-skill-forge",
              order: 60,
              locale: NS,
              inject: () => ({ scope }),
            },
            ForgeRow
          )
        );
      }
    }
    // #endregion

    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  },
});