// test/skillfile.test.mjs — unit tests for the SKILL.md domain.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateDraft, renderSkillFile, skillPaths, parseFrontmatterBool, SKILL_NAME_RE } from "../lib/skillfile.js";

describe("SKILL_NAME_RE", () => {
  it("accepts kebab-case", () => {
    assert.match("my-task", SKILL_NAME_RE);
    assert.match("a1-b2", SKILL_NAME_RE);
  });
  it("rejects bad names", () => {
    assert.doesNotMatch("My_Task", SKILL_NAME_RE);
    assert.doesNotMatch("-lead", SKILL_NAME_RE);
  });
});

describe("validateDraft", () => {
  it("normalizes a good draft", () => {
    const d = validateDraft({ name: "my-task", description: "Do the thing", body: "Steps." });
    assert.equal(d.name, "my-task");
  });
  it("rejects missing fields", () => {
    assert.throws(() => validateDraft({}), /Invalid skill draft/);
  });
});

describe("renderSkillFile", () => {
  it("renders frontmatter + body", () => {
    const text = renderSkillFile({ name: "my-task", description: "Do the thing", body: "Steps.\n" });
    assert.match(text, /^---\nname: "my-task"/);
    assert.match(text, /Steps\./);
  });
  it("writes explicit opt-outs only", () => {
    const text = renderSkillFile({ name: "n", description: "d", body: "b\n", modelInvocable: false });
    assert.match(text, /disable-model-invocation: true/);
  });
});

describe("skillPaths", () => {
  it("resolves the bundle file", () => {
    const p = skillPaths("C:/proj", ".agents/skills", "my-task");
    assert.equal(p.file, "C:/proj/.agents/skills/my-task/SKILL.md");
  });
});

describe("parseFrontmatterBool", () => {
  it("parses yes/no forms", () => {
    assert.equal(parseFrontmatterBool("yes").value, true);
    assert.equal(parseFrontmatterBool("off").value, false);
  });
});
