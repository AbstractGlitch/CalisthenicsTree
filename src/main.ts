/**
 * App shell: hash router, bottom nav, and one event dispatcher.
 *
 * Every screen is a pure function of one projection, recomputed from the log on each
 * render. There is no view state to keep in sync with the data because there is no stored
 * state that could disagree with it.
 *
 * Routing is on the hash rather than in a variable: without it the phone's back button
 * leaves the app entirely and a reload drops you back at the top. In an installed PWA
 * that is the difference between an app and a web page.
 */

import "./views/styles.css";
import { CONTENT } from "./content/tree.js";
import { indexSteps, buildTreeProjection } from "./engine/projection.js";
import { exportBackup, importBackup, BackupFormatError } from "./store/backup.js";
import {
  grantOverride, listOverrides, listSets, loadSettings, localDateOf,
  revokeOverride, saveSettings,
} from "./store/log.js";
import { openDb, STORE_META, STORE_SETS } from "./store/db.js";
import { ICON } from "./views/icons.js";
import { handleLogAction, renderLog, setNote, teardownLog, toggleCheck } from "./views/log.js";
import { renderHistory } from "./views/history.js";
import { renderSettings } from "./views/settings.js";
import { renderSkill } from "./views/skill.js";
import { renderToday } from "./views/today.js";
import { renderTree } from "./views/tree.js";
import { toast } from "./views/ui.js";

const app = document.querySelector<HTMLDivElement>("#app")!;
const navEl = document.querySelector<HTMLElement>("nav")!;

type Route =
  | { view: "today" } | { view: "tree" } | { view: "settings" }
  | { view: "skill"; id: string }
  | { view: "log"; stepId: string }
  | { view: "history"; stepId?: string };

function parseHash(): Route {
  const parts = location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  const [head, tail] = parts;
  switch (head) {
    case "tree": return { view: "tree" };
    case "settings": return { view: "settings" };
    case "skill": return tail ? { view: "skill", id: tail } : { view: "tree" };
    // A step id contains a slash ("handstand/wall-plank"), so rejoin the tail.
    case "log": {
      const stepId = parts.slice(1).join("/");
      return stepId ? { view: "log", stepId } : { view: "today" };
    }
    case "history": {
      const stepId = parts.slice(1).join("/");
      return stepId ? { view: "history", stepId } : { view: "history" };
    }
    default: return { view: "today" };
  }
}

/** The nav tab a route belongs under, so a drill-in keeps its parent tab lit. */
function tabOf(route: Route): string {
  if (route.view === "skill" || route.view === "tree") return "tree";
  if (route.view === "log") return "today";
  return route.view;
}

const NAV: Array<{ tab: string; href: string; label: string; icon: string }> = [
  { tab: "today", href: "#/today", label: "Today", icon: ICON.today },
  { tab: "tree", href: "#/tree", label: "Tree", icon: ICON.tree },
  { tab: "history", href: "#/history", label: "History", icon: ICON.history },
  { tab: "settings", href: "#/settings", label: "Settings", icon: ICON.settings },
];

function renderNav(active: string): void {
  navEl.innerHTML = NAV.map(
    (n) => `<button data-nav="${n.href}" class="${n.tab === active ? "on" : ""}"
      aria-current="${n.tab === active ? "page" : "false"}">${n.icon}${n.label}</button>`,
  ).join("");
}

async function loadAll() {
  const [sets, overrides, settings] = await Promise.all([
    listSets(), listOverrides(), loadSettings(),
  ]);
  const projection = buildTreeProjection(CONTENT, sets, overrides, new Date(), settings);
  return { sets, overrides, settings, projection };
}

let rendering = false;
let lastRouteKey = "";

export async function render(): Promise<void> {
  if (rendering) return;
  rendering = true;
  try {
    const route = parseHash();
    const { sets, overrides, settings, projection } = await loadAll();
    const steps = indexSteps(CONTENT);
    const today = localDateOf();

    let html: string;
    switch (route.view) {
      case "tree":
        html = renderTree(CONTENT, projection);
        break;
      case "skill": {
        const s = projection.skills.find((x) => x.skill.id === route.id);
        if (!s) { location.hash = "#/tree"; return; }
        html = renderSkill(s.skill, s);
        break;
      }
      case "log": {
        const step = steps.get(route.stepId);
        const skill = projection.skills.find((x) => x.skill.id === step?.skillId);
        const progress = skill?.steps.find((p) => p.stepId === route.stepId);
        if (!step || !progress) { location.hash = "#/today"; return; }
        html = renderLog(
          step, progress,
          sets.filter((s) => s.stepId === step.id && s.localDate === today && !s.deletedAt),
          skill?.skill.name ?? "Back",
        );
        break;
      }
      case "history":
        html = renderHistory(CONTENT, projection, sets, route.stepId);
        break;
      case "settings":
        html = renderSettings(CONTENT, overrides, settings, sets.filter((s) => !s.deletedAt).length);
        break;
      default:
        html = renderToday(CONTENT, projection, sets.filter((s) => s.localDate === today && !s.deletedAt));
    }
    app.innerHTML = html;
    // Fade only when the route actually changed. Re-rendering the same screen (after
    // logging a set, say) should not flash.
    const key = JSON.stringify(route);
    if (key !== lastRouteKey) {
      app.classList.remove("fade");
      void app.offsetWidth;
      app.classList.add("fade");
      lastRouteKey = key;
    }
    renderNav(tabOf(route));
  } finally {
    rendering = false;
  }
}

/* ------------------------------------------------------------------ actions ---- */

async function onAction(act: string): Promise<void> {
  const route = parseHash();

  if (route.view === "log") {
    const step = indexSteps(CONTENT).get(route.stepId);
    if (step && (await handleLogAction(act, step, CONTENT.contentVersion, () => void render()))) {
      await render();
    }
    return;
  }

  const grant = /^grant:(.+)$/.exec(act);
  if (grant?.[1]) {
    const stepId = grant[1];
    const reason = prompt(
      "Why are you unlocking this? A short note, for your future self.\n\n" +
        "For example: \"held a 60s chest-to-wall before I started tracking\".",
    );
    // The reason is mandatory in the data model; the UI must not offer a way around it.
    if (!reason?.trim()) { toast("An unlock needs a reason."); return; }
    await grantOverride(stepId, reason.trim());
    toast("Unlocked.");
    await render();
    return;
  }

  const revoke = /^revoke:(.+)$/.exec(act);
  if (revoke?.[1]) {
    const reason = prompt("Why are you revoking this?") ?? "";
    if (!reason.trim()) { toast("A revocation needs a reason."); return; }
    await revokeOverride(revoke[1], reason.trim());
    toast("Revoked.");
    await render();
    return;
  }

  if (act === "export") { await doExport(); return; }
  if (act === "import") { document.querySelector<HTMLInputElement>("#import-file")?.click(); return; }
  if (act === "save-tuning") { await saveTuning(); return; }
  if (act === "reset-tuning") {
    const s = await loadSettings();
    const { consolidationOverride: _drop, ...rest } = s;
    await saveSettings(rest);
    toast("Back to defaults.");
    await render();
    return;
  }
  if (act === "reset") { await doReset(); return; }
}

async function doExport(): Promise<void> {
  try {
    const data = JSON.stringify(await exportBackup(CONTENT.contentVersion), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `calisthenics-tree-${localDateOf()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    toast("Backup downloaded.");
  } catch {
    toast("Couldn't export here.");
  }
}

async function onImportFile(file: File): Promise<void> {
  try {
    const result = await importBackup(await file.text());
    toast(`Restored ${result.sets} sets.`);
    await render();
  } catch (e) {
    toast(e instanceof BackupFormatError ? e.message : "Couldn't read that file.");
  }
}

async function saveTuning(): Promise<void> {
  const num = (sel: string) => {
    const el = document.querySelector<HTMLInputElement>(sel);
    const n = Number(el?.value);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
  };
  const qualifyingSessions = num('[data-tune="qualifyingSessions"]');
  const withinDays = num('[data-tune="withinDays"]');
  if (!qualifyingSessions || !withinDays) { toast("Both need to be whole numbers above zero."); return; }
  const settings = await loadSettings();
  await saveSettings({ ...settings, consolidationOverride: { qualifyingSessions, withinDays } });
  toast("Saved.");
  await render();
}

async function doReset(): Promise<void> {
  if (!confirm(
    "Erase every set, unlock and setting on this device?\n\n" +
      "There is no server and no backup but the one you export. This cannot be undone.",
  )) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_SETS, STORE_META], "readwrite");
    tx.objectStore(STORE_SETS).clear();
    tx.objectStore(STORE_META).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  try { localStorage.clear(); } catch { /* storage disabled; nothing to clear */ }
  toast("Erased.");
  location.hash = "#/today";
  await render();
}

/* ------------------------------------------------------------------ wiring ---- */

document.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;

  const nav = target.closest<HTMLElement>("[data-nav]");
  if (nav?.dataset.nav) {
    teardownLog();
    location.hash = nav.dataset.nav;
    return;
  }

  const action = target.closest<HTMLElement>("[data-act]");
  if (action?.dataset.act) {
    void onAction(action.dataset.act);
  }
});

document.addEventListener("change", (e) => {
  const target = e.target as HTMLElement;

  const check = target.closest<HTMLInputElement>("[data-check]");
  if (check?.dataset.check) { toggleCheck(check.dataset.check, check.checked); return; }

  if (target.id === "import-file") {
    const file = (target as HTMLInputElement).files?.[0];
    if (file) void onImportFile(file);
  }
});

document.addEventListener("input", (e) => {
  const target = e.target as HTMLInputElement;
  if (target.hasAttribute("data-note")) setNote(target.value);
});

window.addEventListener("hashchange", () => {
  teardownLog();
  void render();
});

// A backgrounded tab has its timers throttled; repaint on return so the elapsed value
// shown catches up immediately rather than at the next tick.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) void render();
});

if (!location.hash) location.hash = "#/today";
void render();
