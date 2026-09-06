// dsh-skill-forge — pure workspace resolution (no ctx).
//
// The single identity rule (same as dsh-wiki lib/workspace.js): a forged
// skill belongs to exactly one DSH workspace — the CALLING session's
// workspace — and is saved under that workspace's root. No path-derived
// keys, no static config pin.
//
// Source of truth is the host workspace registry (ctx.workspaceRegistry,
// provided by @deepseek-ai/dsh-workspace):
//   registry.list() -> [{ id, path, title, sessionIds[] }]
// A tool call resolves its CALLING session (exec.agent.session.header.id)
// through that list — the exact pattern the DSH core itself uses.
// Subagent sessions resolve through their ancestry (sessionQuery.traceSession):
// the first ancestor owned by a workspace wins.
// A session owned by NO workspace has NO forge target: tools throw
// no-workspace (fail fast — never write outside a workspace).

// Read the calling session header from a tool execution context.
export function sessionHeaderOf(exec) {
  try {
    const header = exec?.agent?.session?.header;
    if (!header || typeof header !== "object") return undefined;
    return header;
  } catch {
    return undefined;
  }
}

// Find the registry record that owns a session id.
export function workspaceForSession(registry, sessionId) {
  if (!registry || typeof registry.list !== "function") return undefined;
  if (typeof sessionId !== "string" || sessionId === "") return undefined;
  const items = registry.list();
  if (!Array.isArray(items)) return undefined;
  return items.find((item) => Array.isArray(item.sessionIds) && item.sessionIds.includes(sessionId));
}

/**
 * Resolve the workspace of the calling session, following subagent ancestry.
 * Returns { workspaceId, workspaceRoot } — the registry UUID and its
 * canonical path (path is a mirror for file access, never an identity).
 * Throws Error no-session | no-registry | no-workspace.
 */
export async function resolveSessionWorkspace(runtime, exec) {
  const header = sessionHeaderOf(exec);
  const sessionId = header && typeof header.id === "string" && header.id !== "" ? header.id : undefined;
  if (!sessionId) {
    throw new Error("no-session: this call carries no session id. Run the forge from the project workspace chat.");
  }
  const registry = runtime ? runtime.workspaceRegistry : undefined;
  if (!registry || typeof registry.list !== "function") {
    throw new Error("no-registry: the DSH workspace registry is unavailable. Mount @deepseek-ai/dsh-workspace in this run.");
  }
  const direct = workspaceForSession(registry, sessionId);
  if (direct) {
    return { workspaceId: String(direct.id), workspaceRoot: direct.path ?? "" };
  }
  const parentId = header && typeof header.parentSession === "string" && header.parentSession !== "" ? header.parentSession : undefined;
  if (header && header.origin === "subagent" && parentId) {
    const query = runtime ? runtime.sessionQuery : undefined;
    if (query && typeof query.traceSession === "function") {
      let lineage = null;
      try { lineage = await query.traceSession(sessionId); } catch { lineage = null; }
      const ancestors = (lineage && Array.isArray(lineage.ancestors) ? lineage.ancestors : [])
        .map((a) => a && a.header && a.header.id)
        .filter((id) => typeof id === "string" && id !== "");
      for (const ancestorId of [parentId, ...ancestors]) {
        const owner = workspaceForSession(registry, ancestorId);
        if (owner) return { workspaceId: String(owner.id), workspaceRoot: owner.path ?? "" };
      }
    }
  }
  throw new Error("no-workspace: this session belongs to no workspace. Open the project workspace and run the forge from its chat.");
}
