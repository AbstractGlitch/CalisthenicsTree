/**
 * Log a set.
 *
 * The controls are chosen from the step's own Criterion, so adding a criterion kind to the
 * schema surfaces here rather than needing a parallel list of form widgets. Everything is
 * sized for one thumb, standing up, mid-workout.
 */

import type { Criterion, ProgressionStep } from "../content/schema.js";
import { describeStandard, setMeetsStandard, setsRequired } from "../engine/criterion.js";
import * as T from "../engine/timer.js";
import type { LoggedSet, SetValue, StepProgress } from "../engine/types.js";
import { appendSet, currentSessionId, tombstoneSet } from "../store/log.js";
import { esc, toast } from "./ui.js";

/** Draft state for the screen, held while the user is entering one set. */
interface Draft {
  timer: T.TimerState;
  reps: number;
  left: number;
  right: number;
  metres: number;
  checked: Set<string>;
  rpe?: number | undefined;
  note: string;
  rest: T.TimerState;
  restTargetMs: number;
}

let draft: Draft | undefined;
let activeStep: ProgressionStep | undefined;
let ticker: ReturnType<typeof setInterval> | undefined;
let wakeLock: { release: () => Promise<void> } | undefined;

function freshDraft(standard: Criterion): Draft {
  return {
    timer: T.IDLE,
    // Prefill to the standard: the common case is hitting the target, and a stepper that
    // starts at zero makes the user tap eight times to say the expected thing.
    reps: standard.kind === "reps" ? standard.reps : 0,
    left: standard.kind === "reps_each_side" ? standard.reps : 0,
    right: standard.kind === "reps_each_side" ? standard.reps : 0,
    metres: standard.kind === "distance" ? standard.metres : 0,
    checked: new Set<string>(),
    note: "",
    rest: T.IDLE,
    restTargetMs: 90_000,
  };
}

/** Stop the repaint loop and release the screen lock when leaving the screen. */
export function teardownLog(): void {
  if (ticker) clearInterval(ticker);
  ticker = undefined;
  void wakeLock?.release().catch(() => {});
  wakeLock = undefined;
}

/**
 * Keep the screen awake while a hold is running.
 *
 * Progressive enhancement: unsupported on some browsers, and rejected outright when the
 * document is not visible. Failure is silent because a missing wake lock degrades the
 * experience without affecting the recorded data.
 */
async function requestWakeLock(): Promise<void> {
  try {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> };
    };
    if (nav.wakeLock && !wakeLock) wakeLock = await nav.wakeLock.request("screen");
  } catch {
    // No wake lock available. The timer is still correct; the screen may just dim.
  }
}

function currentValue(step: ProgressionStep, d: Draft, now: number): SetValue | undefined {
  switch (step.standard.kind) {
    case "hold": {
      const seconds = Math.floor(T.elapsedSeconds(d.timer, now));
      return seconds > 0 ? { kind: "hold", seconds } : undefined;
    }
    case "reps":
      return d.reps > 0 ? { kind: "reps", reps: d.reps } : undefined;
    case "reps_each_side":
      return d.left > 0 || d.right > 0
        ? { kind: "reps_each_side", left: d.left, right: d.right }
        : undefined;
    case "distance":
      return d.metres > 0 ? { kind: "distance", metres: d.metres } : undefined;
    case "quality":
      return {
        kind: "quality",
        checked: [...d.checked],
        passed: step.standard.checklist.every((c) => d.checked.has(c)),
      };
  }
}

function controls(step: ProgressionStep, d: Draft, now: number): string {
  const std = step.standard;
  switch (std.kind) {
    case "hold": {
      const ms = T.elapsedMs(d.timer, now);
      const met = ms >= std.seconds * 1000;
      const running = T.isRunning(d.timer);
      return `
        <div class="timer ${met ? "met" : ""}" id="tick" aria-live="off">${T.formatDuration(ms)}</div>
        <div class="timer-target" id="tick-target">${met ? "Standard met" : `Target ${std.seconds}s`}</div>
        <button class="btn big ${running ? "" : "primary"}" data-act="${running ? "stop" : "start"}">
          ${running ? "Stop" : ms > 0 ? "Resume" : "Start"}
        </button>
        ${ms > 0 ? '<div class="btns"><button class="btn ghost" data-act="reset-timer">Reset</button></div>' : ""}`;
    }
    case "reps":
      return stepper("reps", d.reps, "reps");
    case "reps_each_side":
      return `<div class="side-by-side">
        <div><div class="stepper-label">Left</div>${stepper("left", d.left, "")}</div>
        <div><div class="stepper-label">Right</div>${stepper("right", d.right, "")}</div>
      </div>`;
    case "distance":
      return `${stepper("metres", d.metres, "metres", 1)}
        <div class="btns" style="justify-content:center">
          <button class="btn" data-act="metres+5">+5m</button>
        </div>`;
    case "quality":
      return `<div class="card">${std.checklist
        .map(
          (item, i) => `<label class="check">
            <input type="checkbox" data-check="${esc(item)}" ${d.checked.has(item) ? "checked" : ""}
              id="chk${i}" />
            <span class="grow">${esc(item)}</span>
          </label>`,
        )
        .join("")}</div>`;
  }
}

function stepper(field: string, value: number, unit: string, step = 1): string {
  return `<div class="counter" style="justify-content:center">
    <button data-act="dec:${field}:${step}" aria-label="Decrease">&minus;</button>
    <div class="val" aria-live="polite">${value}</div>
    <button data-act="inc:${field}:${step}" aria-label="Increase">+</button>
  </div>${unit ? `<div class="stepper-label">${esc(unit)}</div>` : ""}`;
}

export function renderLog(
  step: ProgressionStep,
  progress: StepProgress,
  todaysSets: readonly LoggedSet[],
  skillName: string,
  now = Date.now(),
): string {
  // Keyed to the step, not to how the user arrived: a draft is reset by landing on a
  // different step's screen, whether that was a tap, the back button, or a pasted URL.
  if (!draft || activeStep?.id !== step.id) draft = freshDraft(step.standard);
  activeStep = step;
  const d = draft;
  const value = currentValue(step, d, now);
  const qualifying = todaysSets.filter((s) => setMeetsStandard(s, step.standard)).length;
  const need = setsRequired(step.standard);
  const restMs = T.remainingMs(d.rest, now, d.restTargetMs);

  return `
    <button class="btn back" data-nav="#/skill/${encodeURIComponent(step.skillId)}">&larr; ${esc(skillName)}</button>
    <h1>${esc(step.name)}</h1>
    <p class="sub"><b>${esc(describeStandard(step.standard))}</b> &middot; ${esc(step.cue)}</p>

    ${controls(step, d, now)}

    <label class="lbl" for="rpe">How hard did that feel? (optional)</label>
    <div class="chips" id="rpe">
      ${[5, 6, 7, 8, 9, 10]
        .map((n) => `<button class="chip ${d.rpe === n ? "on" : ""}" data-act="rpe:${n}">${n}</button>`)
        .join("")}
    </div>

    <label class="lbl" for="note">Note (optional)</label>
    <input class="field" id="note" data-note value="${esc(d.note)}" placeholder="Felt solid, wrists fine" />

    <div class="btns">
      <button class="btn primary big" data-act="save" ${value ? "" : "disabled"}>
        ${value ? "Log this set" : "Nothing to log yet"}
      </button>
    </div>

    ${
      T.isRunning(d.rest)
        ? `<p class="note" style="text-align:center;font-size:15px;color:var(--accent2)">
             Rest: <span id="tick-rest">${T.formatDuration(restMs)}</span>
             <button class="btn ghost" data-act="rest-stop">Skip</button></p>`
        : ""
    }

    <h2>This session</h2>
    ${
      todaysSets.length === 0
        ? '<div class="card"><div class="empty">No sets logged today.</div></div>'
        : `<div class="card">${todaysSets
            .map(
              (s) => `<div class="row">
                <div class="grow">
                  <div class="t">${esc(describeValue(s.value))}${
                    setMeetsStandard(s, step.standard) ? ' <span style="color:var(--good)">&check;</span>' : ""
                  }</div>
                  ${s.rpe ? `<div class="d">RPE ${s.rpe}</div>` : ""}
                  ${s.note ? `<div class="d">${esc(s.note)}</div>` : ""}
                </div>
                <button class="btn ghost" data-act="undo:${esc(s.id)}">Undo</button>
              </div>`,
            )
            .join("")}</div>`
    }
    <p class="note">${qualifying >= need
      ? `Session counts. ${esc(progress.reason)}`
      : `${qualifying} of ${need} qualifying ${need === 1 ? "set" : "sets"} this session.`}</p>
  `;
}

export function describeValue(v: SetValue): string {
  switch (v.kind) {
    case "hold": return `${v.seconds}s hold`;
    case "reps": return `${v.reps} reps`;
    case "reps_each_side": return `${v.left} / ${v.right} each side`;
    case "distance": return `${v.metres}m`;
    case "quality": return v.passed ? "Form check passed" : "Form check, not all points";
  }
}

/**
 * Advance the on-screen clock without rebuilding the screen.
 *
 * A full re-render every 250ms destroys and recreates the Stop button under the user's
 * thumb -- it becomes genuinely hard to tap, and the route-change fade restarts on every
 * frame. Only the digits change on a tick, so only the digits are written.
 */
export function paintTick(): void {
  const d = draft;
  const step = activeStep;
  if (!d || !step) return;
  const now = Date.now();

  const el = document.querySelector<HTMLElement>("#tick");
  if (el && step.standard.kind === "hold") {
    const ms = T.elapsedMs(d.timer, now);
    const met = ms >= step.standard.seconds * 1000;
    el.textContent = T.formatDuration(ms);
    el.classList.toggle("met", met);
    const target = document.querySelector<HTMLElement>("#tick-target");
    if (target) target.textContent = met ? "Standard met" : `Target ${step.standard.seconds}s`;
  }

  const rest = document.querySelector<HTMLElement>("#tick-rest");
  if (rest) rest.textContent = T.formatDuration(T.remainingMs(d.rest, now, d.restTargetMs));
}

/**
 * Handle a tap on the log screen.
 *
 * Returns true when the caller should re-render. Kept as one dispatcher rather than bound
 * listeners because the view is re-rendered wholesale on every change.
 */
export async function handleLogAction(
  act: string,
  step: ProgressionStep,
  contentVersion: string,
  rerender: () => void,
): Promise<boolean> {
  if (!draft) draft = freshDraft(step.standard);
  const d = draft;
  const now = Date.now();

  const startTicking = () => {
    if (ticker) return;
    // 250ms so the seconds digit turns over promptly. The displayed value is computed from
    // wall-clock timestamps, so a throttled or skipped tick costs nothing but a late repaint.
    ticker = setInterval(paintTick, 250);
  };
  void rerender;

  if (act === "start") { d.timer = T.start(d.timer, now); void requestWakeLock(); startTicking(); return true; }
  if (act === "stop") { d.timer = T.stop(d.timer, now); teardownLog(); return true; }
  if (act === "reset-timer") { d.timer = T.reset(); teardownLog(); return true; }
  if (act === "rest-stop") { d.rest = T.reset(); teardownLog(); return true; }

  const stepMatch = /^(inc|dec):(\w+):(\d+)$/.exec(act);
  if (stepMatch) {
    const [, dir, field, byRaw] = stepMatch;
    const by = Number(byRaw) * (dir === "inc" ? 1 : -1);
    const key = field as "reps" | "left" | "right" | "metres";
    d[key] = Math.max(0, d[key] + by);
    return true;
  }
  if (act === "metres+5") { d.metres += 5; return true; }

  const rpe = /^rpe:(\d+)$/.exec(act);
  if (rpe) { const n = Number(rpe[1]); d.rpe = d.rpe === n ? undefined : n; return true; }

  const undo = /^undo:(.+)$/.exec(act);
  if (undo?.[1]) { await tombstoneSet(undo[1]); toast("Set removed."); return true; }

  if (act === "save") {
    const value = currentValue(step, d, now);
    if (!value) return false;
    await appendSet(step.id, value, currentSessionId(), contentVersion, {
      ...(d.rpe !== undefined ? { rpe: d.rpe } : {}),
      ...(d.note.trim() ? { note: d.note.trim() } : {}),
    });
    toast("Logged.");
    // Keep RPE and note conventions for the next set; clear the measurement itself.
    const rest = T.start(T.IDLE, now);
    draft = { ...freshDraft(step.standard), rpe: d.rpe, rest, restTargetMs: d.restTargetMs };
    teardownLog();
    startTicking();
    return true;
  }
  return false;
}

export function setNote(text: string): void {
  if (draft) draft.note = text;
}

export function toggleCheck(item: string, on: boolean): void {
  if (!draft) return;
  if (on) draft.checked.add(item);
  else draft.checked.delete(item);
}
