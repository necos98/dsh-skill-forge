// test/config.test.mjs — config domain tests.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveConfig, DEFAULT_SKILL_ROOT } from "../lib/config.js";

describe("resolveConfig", () => {
  it("applies defaults", () => {
    const c = resolveConfig({});
    assert.equal(c.defaultSkillRoot, DEFAULT_SKILL_ROOT);
  });
  it("rejects unknown keys", () => {
    assert.throws(() => resolveConfig({ nope: 1 }), /unknown key/);
  });
});
