/** What to train now, and what has already been done today. */

import type { TreeContent } from "../content/schema.js";
import { describeStandard } from "../engine/criterion.js";
import { indexSteps } from "../engine/projection.js";
import type { LoggedSet, TreeProjection } from "../engine/types.js";
import { describeValue } from "./log.js";
import { esc } from "./ui.js";

export function renderToday(
  content: TreeContent,
  projection: TreeProjection,
  todaysSets: readonly LoggedSet[],
): string {
  const steps = indexSteps(content);

  const upNext = projection.nextUp
    .map((ref) => {
      const step = steps.get(ref.stepId);
      if (!step) return "";
      const skill = projection.skills.find((s) => s.skill.id === step.skillId);
      const progress = skill?.steps.find((p) => p.stepId === step.id);
      return `<div class="row">
        <div class="grow">
          <div class="t">${esc(step.name)}</div>
          <div class="d">${esc(skill?.skill.name ?? "")} &middot; <b>${esc(describeStandard(step.standard))}</b></div>
          ${progress ? `<div class="reason">${esc(progress.reason)}</div>` : ""}
        </div>
        <button class="btn primary" data-nav="#/log/${encodeURIComponent(step.id)}">Log</button>
      </div>`;
    })
    .join("");

  const done = todaysSets.length
    ? `<div class="card">${[...todaysSets]
        .reverse()
        .map((s) => {
          const step = steps.get(s.stepId);
          return `<div class="row">
            <div class="grow">
              <div class="t">${esc(step?.name ?? s.stepId)}</div>
              <div class="d">${esc(describeValue(s.value))}${s.rpe ? ` &middot; RPE ${s.rpe}` : ""}</div>
            </div>
          </div>`;
        })
        .join("")}</div>`
    : '<div class="card"><div class="empty">Nothing logged yet today.</div></div>';

  return `
    <h1>Today</h1>
    <p class="sub">${projection.counts.consolidated} consolidated &middot;
      ${projection.counts.inProgress} in progress &middot;
      ${projection.counts.available} ready &middot; ${projection.counts.locked} locked</p>

    <h2>Up next</h2>
    ${upNext ? `<div class="card">${upNext}</div>`
      : '<div class="card"><div class="empty">Everything unlocked is consolidated. Time to add a skill.</div></div>'}

    <h2>Logged today</h2>
    ${done}
  `;
}
