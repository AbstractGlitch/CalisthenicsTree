/**
 * One skill's ladder.
 *
 * Every sentence of state shown here comes from the engine's `reason`, so this screen and
 * the map can never tell the user two different things.
 */

import type { Skill } from "../content/schema.js";
import { describeStandard } from "../engine/criterion.js";
import type { SkillProjection } from "../engine/types.js";
import { describeValue } from "./log.js";
import { esc, relativeDay } from "./ui.js";

const MARK: Record<string, string> = {
  consolidated: "&check;", stale: "&check;", achieved: "&middot;",
  practising: "", untouched: "",
};

export function renderSkill(skill: Skill, projection: SkillProjection): string {
  const locked = projection.unlock.status === "locked";

  const steps = projection.steps
    .map((p) => {
      const step = skill.steps.find((s) => s.id === p.stepId)!;
      const current = p.stepId === projection.currentStepId;
      return `<div class="row" data-a="${p.attainment}">
        <div class="dot">${MARK[p.attainment] ?? ""}</div>
        <div class="grow">
          <div class="t">${esc(step.name)}${current ? ' <span style="color:var(--accent2)">&larr; now</span>' : ""}</div>
          <div class="d">${esc(step.cue)}</div>
          <div class="d"><b>${esc(describeStandard(step.standard))}</b> &middot; ${esc(step.why)}</div>
          <div class="reason">${esc(p.reason)}</div>
          ${p.best ? `<div class="d">Best: ${esc(describeValue(p.best))}${
            p.lastPracticedAt ? ` &middot; last trained ${esc(relativeDay(p.lastPracticedAt))}` : ""
          }</div>` : ""}
          <div class="btns">
            ${locked ? "" : `<button class="btn ${current ? "primary" : ""}"
              data-nav="#/log/${encodeURIComponent(p.stepId)}">Log a set</button>`}
            ${p.totalSessions > 0 ? `<button class="btn ghost"
              data-nav="#/history/${encodeURIComponent(p.stepId)}">History</button>` : ""}
          </div>
        </div>
      </div>`;
    })
    .join("");

  const firstStep = skill.steps[0];

  return `
    <button class="btn back" data-nav="#/tree">&larr; Tree</button>
    <h1>${esc(skill.name)}</h1>
    <p class="sub">${esc(skill.blurb)}</p>
    <p class="sub" style="color:var(--accent2)">${esc(projection.unlock.reason)}</p>
    ${
      locked && skill.manualUnlockAllowed !== false && firstStep
        ? `<div class="btns">
             <button class="btn" data-act="grant:${esc(firstStep.id)}">I can already do this</button>
           </div>
           <p class="note">Unlocking by hand is for skills you had before you started
             tracking. It opens the ladder; it does not mark anything as done.</p>`
        : ""
    }
    <div class="card" style="margin-top:14px">${steps}</div>
  `;
}
