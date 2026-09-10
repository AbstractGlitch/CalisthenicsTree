/**
 * The map.
 *
 * Nodes are positioned divs, edges are one inline <svg> of quadratic curves -- the same
 * zero-dependency approach as roadmap-studio's RoadmapPreview. Colour and dash come from
 * the projection, never from a second local judgement about state.
 */

import type { TreeContent } from "../content/schema.js";
import { layoutTree } from "../engine/layout.js";
import { buildUnlockGraph } from "../engine/projection.js";
import type { TreeProjection, UnlockEdge } from "../engine/types.js";
import { ACTION_LABEL, esc } from "./ui.js";

/**
 * A shallow quadratic curve. `index` bends successive edges into the same target further
 * and alternates sides, so parallel prerequisites stay distinguishable.
 */
function edgePath(x1: number, y1: number, x2: number, y2: number, index: number): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const bend = (index % 2 === 0 ? 1 : -1) * Math.ceil((index + 1) / 2) * 6;
  return `M ${x1} ${y1} Q ${mx} ${my + bend} ${x2} ${y2}`;
}

export function renderTree(content: TreeContent, projection: TreeProjection): string {
  const positions = new Map(layoutTree(content).map((p) => [p.skillId, p]));
  const edges = buildUnlockGraph(content, projection);

  const seen = new Map<string, number>();
  const paths = edges
    .map((e: UnlockEdge) => {
      const from = positions.get(e.fromSkillId);
      const to = positions.get(e.toSkillId);
      if (!from || !to) return "";
      const n = seen.get(e.toSkillId) ?? 0;
      seen.set(e.toSkillId, n + 1);
      return `<path d="${edgePath(from.x, from.y, to.x, to.y, n)}"
        fill="none" stroke="${e.satisfied ? "var(--good)" : "var(--dimmer)"}"
        stroke-width="0.4" ${e.gate === "achieved" ? 'stroke-dasharray="2 1.5"' : ""} />`;
    })
    .join("");

  const nodes = projection.skills
    .map((s) => {
      const p = positions.get(s.skill.id)!;
      const done = s.consolidatedSteps;
      // The tick is not decoration: gold and green measure dE 14.9 for normal vision,
      // below the readable floor, so colour alone must never be what tells a finished
      // skill from one in progress.
      const mark = s.action === "consolidated" || s.action === "needs_refresh" ? " &check;" : "";
      return `<button class="node" data-action="${s.action}" data-nav="#/skill/${encodeURIComponent(s.skill.id)}"
        style="left:${p.x}%; top:${p.y}%"
        title="${esc(s.unlock.reason)}"
        aria-label="${esc(s.skill.name)} -- ${ACTION_LABEL[s.action]}. ${esc(s.unlock.reason)}"
        ${s.action === "locked" ? "disabled" : ""}
      >${esc(s.skill.name)}${mark} <span style="color:var(--dim)">${done}/${s.totalSteps}</span></button>`;
    })
    .join("");

  const nextUp = projection.nextUp[0];
  const nextName = nextUp
    ? content.skills.flatMap((s) => s.steps).find((s) => s.id === nextUp.stepId)?.name
    : undefined;

  return `
    <h1>The tree</h1>
    <p class="sub">${projection.counts.consolidated} consolidated &middot;
      ${projection.counts.inProgress} in progress &middot;
      ${projection.counts.available} ready &middot; ${projection.counts.locked} locked</p>
    <div class="legend">
      <span><i class="swatch" style="background:var(--accent)"></i>ready or in progress</span>
      <span><i class="swatch" style="background:var(--good)"></i>consolidated</span>
      <span><i class="swatch" style="background:var(--dimmer)"></i>locked</span>
      <span>dashed edge = a softer gate (achieved, not consolidated)</span>
    </div>
    <div class="map-scroll">
      <div class="map">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">${paths}</svg>
        ${nodes}
      </div>
    </div>
    ${nextName ? `<p class="note">Next up: <b>${esc(nextName)}</b></p>` : ""}
  `;
}
