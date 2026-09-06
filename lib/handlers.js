// dsh-skill-forge — pure handlers: policy text + /skill-forge command.
// Kept free of ctx so they are unit-testable in isolation.

// Build the system-prompt section text function. Renders only while
// state.enabled is true, so a runtime flip applies from the next prompt
// assembly without a restart.
export function createPolicyText(state) {
  return () => (state.enabled ? state.section : "");
}

// Default distillation policy: how the agent turns a finished task into a
// reusable project skill. The human confirms every draft before it is saved.
export const DEFAULT_SECTION = [
  "When the human asks to reuse a finished task, distill it into a project skill with the skill_forge tools.",
  "Draft with skill_forge_draft, show the preview to the human, and save with skill_forge_save only after explicit confirmation.",
  "Generalize the task, keep the body focused and reusable, and never invent facts the conversation did not establish.",
  "Skills are saved per workspace under .agents/skills and appear in the session catalog from the next step.",
].join(" ");

// Build the /skill-forge command handler.
export function createCommandHandler(state) {
  return ({ rawInput }) => {
    const argument = (rawInput ?? "").trim();
    if (argument === "on") {
      state.enabled = true;
      return { kind: "success", text: "Skill-forge policy section ON." };
    }
    if (argument === "off") {
      state.enabled = false;
      return { kind: "success", text: "Skill-forge policy section OFF." };
    }
    if (argument === "status") {
      return {
        kind: "success",
        text: state.enabled ? "Skill-forge policy section is ON." : "Skill-forge policy section is OFF.",
      };
    }
    return {
        kind: "success",
        text: "Usage: /skill-forge [on|off|status|help]. To forge a skill, ask the agent to distill this task: it drafts, you confirm, it saves under .agents/skills.",
      };
  };
}