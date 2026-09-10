/**
 * Settings: backup, tuning, overrides, reset.
 *
 * With no server, export is the only backup that exists, so it leads.
 */

import { DEFAULT_CONSOLIDATION, type TreeContent } from "../content/schema.js";
import { indexSteps } from "../engine/projection.js";
import { activeOverrides } from "../engine/unlock.js";
import type { ManualOverride, UserSettings } from "../engine/types.js";
import { esc } from "./ui.js";

export function renderSettings(
  content: TreeContent,
  overrides: readonly ManualOverride[],
  settings: UserSettings,
  setCount: number,
): string {
  const steps = indexSteps(content);
  const active = [...activeOverrides(overrides).values()];
  const tuning = settings.consolidationOverride;

  return `
    <h1>Settings</h1>
    <p class="sub">${setCount} ${setCount === 1 ? "set" : "sets"} recorded &middot;
      tree ${esc(content.contentVersion)}</p>

    <h2>Backup</h2>
    <div class="card"><div class="row"><div class="grow">
      <div class="t">Your data lives only on this device</div>
      <div class="d">There is no account and no server. If you lose the phone, an export is
        the only way back. Keep one somewhere safe.</div>
    </div></div></div>
    <div class="btns">
      <button class="btn primary" data-act="export">Export backup</button>
      <button class="btn" data-act="import">Import backup</button>
    </div>
    <input type="file" id="import-file" accept="application/json,.json" hidden />

    <h2>Consolidation</h2>
    <div class="card"><div class="row"><div class="grow">
      <div class="t">How much repetition counts as a skill</div>
      <div class="d">A step consolidates after this many qualifying sessions inside the
        window. Prerequisites open on consolidated, not on a single good day.</div>
    </div></div></div>
    <label class="lbl" for="sessions">Qualifying sessions</label>
    <input class="field" id="sessions" type="number" min="1" max="10" inputmode="numeric"
      data-tune="qualifyingSessions"
      value="${tuning?.qualifyingSessions ?? DEFAULT_CONSOLIDATION.qualifyingSessions}" />
    <label class="lbl" for="days">Within how many days</label>
    <input class="field" id="days" type="number" min="1" max="180" inputmode="numeric"
      data-tune="withinDays"
      value="${tuning?.withinDays ?? DEFAULT_CONSOLIDATION.withinDays}" />
    <div class="btns"><button class="btn" data-act="save-tuning">Save</button>
      ${tuning ? '<button class="btn ghost" data-act="reset-tuning">Back to defaults</button>' : ""}</div>

    <h2>Manual unlocks</h2>
    ${active.length
      ? `<div class="card">${active
          .map(
            (o) => `<div class="row">
              <div class="grow">
                <div class="t">${esc(steps.get(o.stepId)?.name ?? o.stepId)}</div>
                <div class="d">${esc(o.reason)}</div>
              </div>
              <button class="btn ghost" data-act="revoke:${esc(o.stepId)}">Revoke</button>
            </div>`,
          )
          .join("")}</div>`
      : `<div class="card"><div class="empty">None. You can grant one from a locked skill
           if you could already do it before you started tracking.</div></div>`}

    <h2>Danger</h2>
    <div class="btns">
      <button class="btn danger" data-act="reset">Erase everything</button>
    </div>
    <p class="note">Erasing removes every set, override and setting on this device and
      cannot be undone. Export first.</p>
  `;
}
