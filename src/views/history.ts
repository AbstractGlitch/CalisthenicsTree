/**
 * Progress over time.
 *
 * One chart form, used consistently: best set per session against session order. Session
 * order rather than calendar time, because training is irregular and a time axis mostly
 * renders the gaps rather than the work.
 */

import type { Criterion, TreeContent } from "../content/schema.js";
import { describeStandard } from "../engine/criterion.js";
import { buildStepHistory, type StepHistory } from "../engine/history.js";
import { indexSteps } from "../engine/projection.js";
import type { LoggedSet, TreeProjection } from "../engine/types.js";
import { describeValue } from "./log.js";
import { esc, relativeDay } from "./ui.js";

const W = 320;
const H = 72;

/**
 * A sparkline: one line, no axes, no gridlines, no legend.
 *
 * Choices that are deliberate rather than incidental:
 *
 * - **Zero baseline, not the data minimum.** Auto-zooming turns a 44s-to-47s week into a
 *   dramatic climb, which flatters the reader and misinforms them.
 * - **Session order on x, not calendar time.** Training is irregular; a time axis mostly
 *   renders the gaps between sessions rather than the sessions.
 * - **One end-dot, not a dot per session.** A marker on every point is the "value beside
 *   every mark" failure. The endpoint is the one that earns a marker.
 * - **Qualification is shown positionally, by the dashed threshold, not by colouring the
 *   qualifying points green.** Gold against green measures dE 14.9 for normal vision --
 *   below the readable floor -- so those two must never be the only thing separating two
 *   meanings. Height above a line needs no colour at all.
 * - **Uniform scaling.** No preserveAspectRatio="none": stretching the viewBox turns the
 *   end-dot into an ellipse and thins the stroke horizontally.
 *
 * The session list rendered directly below is this chart's table view.
 */
function sparkline(history: StepHistory, targetValue?: number): string {
  const pts = history.series;
  if (pts.length < 2) return "";
  const max = Math.max(...pts, targetValue ?? 0) * 1.1 || 1;
  const x = (i: number) => (i / (pts.length - 1)) * (W - 12) + 6;
  const y = (v: number) => H - 8 - (v / max) * (H - 18);
  const line = pts.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const lastIndex = pts.length - 1;
  const last = pts[lastIndex]!;
  const target =
    targetValue !== undefined
      ? `<line x1="6" y1="${y(targetValue).toFixed(1)}" x2="${W - 6}" y2="${y(targetValue).toFixed(1)}"
           stroke="var(--dimmer)" stroke-width="1" stroke-dasharray="3 3"/>`
      : "";
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" role="img"
    aria-label="Best set per session, oldest to most recent. Latest ${last}. Full figures in the session list below.">
    ${target}
    <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2"
      stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${x(lastIndex).toFixed(1)}" cy="${y(last).toFixed(1)}" r="4"
      fill="var(--accent)" stroke="var(--card)" stroke-width="2"/>
  </svg>`;
}

/** The number the sparkline's threshold line sits at, where the standard has one. */
function targetOf(standard: Criterion): number | undefined {
  switch (standard.kind) {
    case "hold": return standard.seconds;
    case "reps":
    case "reps_each_side": return standard.reps;
    case "distance": return standard.metres;
    case "quality": return undefined;
  }
}

export function renderHistory(
  content: TreeContent,
  projection: TreeProjection,
  log: readonly LoggedSet[],
  focusStepId?: string,
): string {
  const steps = indexSteps(content);
  const byStep = new Map<string, LoggedSet[]>();
  for (const s of log) {
    if (s.deletedAt) continue;
    const list = byStep.get(s.stepId);
    if (list) list.push(s);
    else byStep.set(s.stepId, [s]);
  }

  if (focusStepId) {
    const step = steps.get(focusStepId);
    if (step) {
      const h = buildStepHistory(step, byStep.get(step.id) ?? []);
      const sessions = [...h.sessions].reverse();
      return `
        <button class="btn back" data-nav="#/history">&larr; History</button>
        <h1>${esc(step.name)}</h1>
        <p class="sub"><b>${esc(describeStandard(step.standard))}</b> &middot;
          ${h.totalSets} ${h.totalSets === 1 ? "set" : "sets"} over ${h.sessions.length}
          ${h.sessions.length === 1 ? "session" : "sessions"}</p>
        ${h.personalBest
          ? `<p class="sub" style="color:var(--good)">Best: ${esc(describeValue(h.personalBest))}
             ${h.personalBestAt ? `&middot; ${esc(relativeDay(h.personalBestAt))}` : ""}</p>`
          : ""}
        ${h.series.length > 1
          ? `<div class="card"><div class="spark-wrap">
               ${sparkline(h, targetOf(step.standard))}
               <div class="d" style="text-align:center">best set per session, oldest first &middot; dashed line is the standard</div>
             </div></div>`
          : ""}
        <h2>Sessions</h2>
        ${sessions.length
          ? `<div class="card">${sessions
              .map(
                (s) => `<div class="row">
                  <div class="grow">
                    <div class="t">${s.best ? esc(describeValue(s.best)) : "&mdash;"}
                      ${s.qualified ? '<span style="color:var(--good)">&check;</span>' : ""}</div>
                    <div class="d">${esc(s.localDate)} &middot; ${esc(relativeDay(s.at))} &middot;
                      ${s.sets} ${s.sets === 1 ? "set" : "sets"}</div>
                  </div>
                </div>`,
              )
              .join("")}</div>`
          : '<div class="card"><div class="empty">Nothing logged for this step yet.</div></div>'}
      `;
    }
  }

  // Index: every step that has been trained, most recently first.
  const trained = projection.skills
    .flatMap((s) => s.steps.map((p) => ({ p, skill: s.skill })))
    .filter((x) => byStep.has(x.p.stepId))
    .sort((a, b) => (b.p.lastPracticedAt ?? "").localeCompare(a.p.lastPracticedAt ?? ""));

  return `
    <h1>History</h1>
    <p class="sub">Every step you have trained.</p>
    ${trained.length
      ? `<div class="card">${trained
          .map(({ p, skill }) => {
            const step = steps.get(p.stepId)!;
            return `<button class="row" style="width:100%;text-align:left"
              data-nav="#/history/${encodeURIComponent(p.stepId)}">
              <div class="grow">
                <div class="t">${esc(step.name)}</div>
                <div class="d">${esc(skill.name)}${p.best ? ` &middot; best ${esc(describeValue(p.best))}` : ""}
                  ${p.lastPracticedAt ? ` &middot; ${esc(relativeDay(p.lastPracticedAt))}` : ""}</div>
              </div>
            </button>`;
          })
          .join("")}</div>`
      : '<div class="card"><div class="empty">Log a set and it will show up here.</div></div>'}
  `;
}
