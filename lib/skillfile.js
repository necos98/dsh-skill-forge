// dsh-skill-forge — pure SKILL.md domain (no ctx, no fs).
//
// The skill-file contract is owned by @deepseek-ai/dsh-skill-filesystem:
// a skill is a directory bundle <name>/SKILL.md (or a flat <name>.md)
// starting with YAML frontmatter: required name + description, optional
// whenToUse, metadata, disable-model-invocation, user-invocable.
// The provider parses frontmatter into the catalog entry and re-reads the
// body on every load. A file with invalid frontmatter/name/flags is skipped
// with a warning — the model cannot tell absent from invalid — so the
// forge validates BEFORE writing, never after.
//
// Name grammar (from dsh-skill isSkillName): /^[a-z0-9]+(?:-[a-z0-9]+)*$/.

// Kebab-case skill-name grammar enforced by the dsh-skill registry.
export const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Max skill-name length (filesystem + catalog safety).
export const MAX_NAME_LENGTH = 64;

// Catalog description cap mirrored from dsh-tool-skill (500).
export const MAX_DESCRIPTION_LENGTH = 500;

// Frontmatter booleans accepted by the filesystem provider (case-insensitive).
const TRUTHY = new Set(["true", "yes", "on", "1"]);
const FALSY = new Set(["false", "no", "off", "0"]);

/**
 * Validate a forged-skill draft. Returns the normalized draft.
 * Draft shape: { name, description, whenToUse?, body, modelInvocable?, userInvocable? }.
 * Throws an Error listing every problem (fail before writing, never after).
 */
export function validateDraft(draft) {
  const problems = [];
  const out = {};
  const d = draft ?? {};

  if (typeof d.name !== "string" || d.name === "") {
    problems.push("name is required (kebab-case, e.g. my-task)");
  } else if (!SKILL_NAME_RE.test(d.name)) {
    problems.push('name "' + d.name + '" must match /^[a-z0-9]+(?:-[a-z0-9]+)*$/');
  } else if (d.name.length > MAX_NAME_LENGTH) {
    problems.push("name must be at most " + MAX_NAME_LENGTH + " chars");
  } else {
    out.name = d.name;
  }

  if (typeof d.description !== "string" || d.description.trim() === "") {
    problems.push("description is required (one line, what the skill does)");
  } else if (d.description.trim().length > MAX_DESCRIPTION_LENGTH) {
    problems.push("description must be at most " + MAX_DESCRIPTION_LENGTH + " chars");
  } else {
    out.description = d.description.trim();
  }

  if (d.whenToUse !== undefined) {
    if (typeof d.whenToUse !== "string" || d.whenToUse.trim() === "") {
      problems.push("whenToUse, when given, must be a non-empty string");
    } else {
      out.whenToUse = d.whenToUse.trim();
    }
  }

  if (typeof d.body !== "string" || d.body.trim() === "") {
    problems.push("body is required (the reusable markdown instructions)");
  } else {
    out.body = d.body.replace(/\r\n/g, "\n").trim() + "\n";
  }

  for (const key of ["modelInvocable", "userInvocable"]) {
    if (d[key] !== undefined && typeof d[key] !== "boolean") {
      problems.push(key + ", when given, must be a boolean");
    } else if (typeof d[key] === "boolean") {
      out[key] = d[key];
    }
  }

  if (problems.length > 0) {
    throw new Error("Invalid skill draft: " + problems.join("; "));
  }
  return out;
}

// Escape a frontmatter scalar (double-quoted YAML).
function yamlScalar(value) {
  return '"' + value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n") + '"';
}

/**
 * Render a validated draft to a SKILL.md document (frontmatter + body).
 * Invocation mapping: modelInvocable false becomes disable-model-invocation true;
 * userInvocable false becomes user-invocable false. Omitted flags permit the
 * surface (provider defaults), so only an explicit false is written.
 */
export function renderSkillFile(draft) {
  const lines = ["---", "name: " + yamlScalar(draft.name), "description: " + yamlScalar(draft.description)];
  if (draft.whenToUse) lines.push("whenToUse: " + yamlScalar(draft.whenToUse));
  if (draft.modelInvocable === false) lines.push("disable-model-invocation: true");
  if (draft.userInvocable === false) lines.push("user-invocable: false");
  lines.push("---", "", draft.body);
  return lines.join("\n");
}

/**
 * Resolve the bundle directory for a skill inside a workspace root.
 * Always the directory form <root>/<name>; the file is SKILL.md.
 * Rejects names that could escape the root.
 */
export function skillPaths(workspaceRoot, skillRoot, name) {
  if (!SKILL_NAME_RE.test(name)) throw new Error('Invalid skill name "' + name + '"');
  const root = String(workspaceRoot ?? "").replace(/\/+$/, "");
  const rel = String(skillRoot ?? ".agents/skills").replace(/^\/+|\/+$/g, "");
  if (rel === "" || rel.split("/").includes("..")) {
    throw new Error("Skill root must stay inside the workspace (no ..)");
  }
  const dir = root + "/" + rel + "/" + name;
  return { dir, file: dir + "/SKILL.md" };
}

/**
 * Parse the YAML frontmatter booleans the provider accepts (for round-trip
 * checks in tests). Returns { value } or { error }.
 */
export function parseFrontmatterBool(raw) {
  const v = String(raw ?? "").trim().toLowerCase();
  if (TRUTHY.has(v)) return { value: true };
  if (FALSY.has(v)) return { value: false };
  return { error: 'invalid boolean "' + raw + '" (want true/false, yes/no, on/off, 1/0)' };
}
