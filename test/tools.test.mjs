// test/tools.test.mjs — tools against a fake ctx.fs service.
// Regression test: ctx.fs is the DSH filesystem service
// (resolve/stat/readText/writeText/listDir), NOT node:fs.
// The first version called fs.mkdir/fs.writeFile and failed with
// fs.mkdir is not a function on the real save path.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { makeToolDefinitions } from "../lib/tools.js";

// Minimal in-memory ctx.fs double with the REAL method names.
function fakeFs(files = {}) {
  const store = { ...files };
  return {
    calls: [],
    async resolve(path) {
      this.calls.push(["resolve", path]);
      return { targetKey: "k:" + path, displayPath: path };
    },
    async stat(target) {
      const hit = Object.hasOwn(store, target.displayPath);
      return hit ? { version: "v1", type: "file" } : undefined;
    },
    async readText(target) {
      if (!Object.hasOwn(store, target.displayPath)) throw new Error("not found");
      return store[target.displayPath];
    },
    async writeText(target, content) {
      this.calls.push(["writeText", target.displayPath]);
      store[target.displayPath] = content;
      return { operation: "create" };
    },
    async listDir(target) {
      const prefix = target.displayPath.replace(/\/+$/, "") + "/";
      const names = new Set();
      for (const p of Object.keys(store)) {
        if (p.startsWith(prefix)) {
          const rest = p.slice(prefix.length).split("/");
          if (rest[0]) names.add(rest[0]);
        }
      }
      return [...names].sort().map((name) => ({ name, type: "directory", target: { targetKey: "k", displayPath: prefix + name } }));
    },
  };
}

function fakeRuntime(fs) {
  return {
    fs,
    defaultSkillRoot: ".agents/skills",
    workspaceRegistry: { list: () => [{ id: "ws-1", path: "C:/proj", sessionIds: ["s1"] }] },
  };
}

const exec = { agent: { session: { header: { id: "s1" } } } };

function tool(defs, name) {
  return defs.find((d) => d.name === name);
}

describe("skill_forge_save", () => {
  it("saves through resolve+writeText (no mkdir)", async () => {
    const fs = fakeFs();
    const defs = makeToolDefinitions(fakeRuntime(fs));
    const out = await tool(defs, "skill_forge_save").execute({ name: "my-task", description: "Do the thing", body: "Steps." }, exec);
    assert.match(out, /\[workspace ws-1\]/);
    assert.match(out, /Saved skill "my-task"/);
    const kinds = fs.calls.map((c) => c[0]);
    assert.ok(kinds.includes("resolve"), "must resolve the target");
    assert.ok(kinds.includes("writeText"), "must write via writeText");
  });

  it("refuses to overwrite without the flag", async () => {
    const fs = fakeFs({ "C:/proj/.agents/skills/my-task/SKILL.md": "old" });
    const defs = makeToolDefinitions(fakeRuntime(fs));
    await assert.rejects(() => tool(defs, "skill_forge_save").execute({ name: "my-task", description: "d", body: "b" }, exec), /already exists/);
  });
});

describe("skill_forge_list / skill_forge_read", () => {
  it("lists through listDir", async () => {
    const fs = fakeFs({ "C:/proj/.agents/skills/a/SKILL.md": "x", "C:/proj/.agents/skills/b/SKILL.md": "y" });
    const defs = makeToolDefinitions(fakeRuntime(fs));
    const out = await tool(defs, "skill_forge_list").execute({}, exec);
    assert.match(out, /- a/);
    assert.match(out, /- b/);
  });

  it("reads through readText", async () => {
    const fs = fakeFs({ "C:/proj/.agents/skills/a/SKILL.md": "hello" });
    const defs = makeToolDefinitions(fakeRuntime(fs));
    const out = await tool(defs, "skill_forge_read").execute({ name: "a" }, exec);
    assert.match(out, /hello/);
  });
});
