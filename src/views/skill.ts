/** One skill's ladder. Every sentence shown here comes from the engine. */

import type { Skill } from "../content/schema.js";
import { describeStandard } from "../engine/criterion.js";
import type { SkillProjection } from "../engine/types.js";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const MARK: Record<string, string> = {
  consolidated: "&check;", stale: "&check;", achieved: "&middot;",
  practising: "", untouched: "", locked: "",
};

export function renderSkill(skill: Skill, projection: SkillProjection): string {
  const steps = projection.steps
    .map((p) => {
      const step = skill.steps.find((s) => s.id === p.stepId)!;
      const current = p.stepId === projection.currentStepId;
      return `<div class="step" data-a="${p.attainment}">
        <div class="dot">${MARK[p.attainment] ?? ""}</div>
        <div>
          <div class="t">${esc(step.name)}${current ? ' <span style="color:var(--accent)">&larr; now</span>' : ""}</div>
          <div class="d">${esc(step.cue)}</div>
          <div class="d"><b>${esc(describeStandard(step.standard))}</b> &middot; ${esc(step.why)}</div>
          <div class="reason">${esc(p.reason)}</div>
        </div>
      </div>`;
    })
    .join("");

  return `
    <button class="back" data-back>&larr; Tree</button>
    <h1>${esc(skill.name)}</h1>
    <p class="sub">${esc(skill.blurb)}</p>
    <p class="sub" style="color:var(--accent)">${esc(projection.unlock.reason)}</p>
    <div class="card">${steps}</div>
  `;
}
