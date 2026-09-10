/**
 * How far through a step is the athlete?
 *
 * This is where the central domain rule lives: a step hit once is `achieved`, but only
 * repeated performance across separate days makes it `consolidated`, and unlock gates
 * default to `consolidated`. Anything looser turns the tree into a checklist that rewards
 * one lucky rep with permission to attempt something that can hurt you.
 */

import {
  DEFAULT_CONSOLIDATION,
  STALE_AFTER_DAYS,
  type Consolidation,
  type ProgressionStep,
} from "../content/schema.js";
import { betterValue, describeStandard, sessionMeetsStandard } from "./criterion.js";
import type { LoggedSet, SetValue, StepProgress, UserSettings } from "./types.js";

const MS_PER_DAY = 86_400_000;

/** Sets of one step, grouped into sessions, oldest first. */
interface Session {
  sessionId: string;
  localDate: string;
  at: number; // ms
  sets: LoggedSet[];
}

/**
 * Group a step's sets into sessions.
 *
 * Keyed by `localDate` rather than `sessionId`: two "sessions" logged on the same calendar
 * day count once. Without this, three qualifying sets in a single afternoon -- or an app
 * restart splitting one workout in two -- would consolidate a skill on the spot.
 */
export function groupIntoSessions(sets: readonly LoggedSet[]): Session[] {
  const byDate = new Map<string, Session>();
  for (const set of sets) {
    if (set.deletedAt) continue;
    const existing = byDate.get(set.localDate);
    if (existing) {
      existing.sets.push(set);
      existing.at = Math.min(existing.at, Date.parse(set.performedAt));
    } else {
      byDate.set(set.localDate, {
        sessionId: set.sessionId,
        localDate: set.localDate,
        at: Date.parse(set.performedAt),
        sets: [set],
      });
    }
  }
  return [...byDate.values()].sort((a, b) => a.at - b.at);
}

export function resolveConsolidation(
  step: ProgressionStep,
  settings?: UserSettings,
): Consolidation {
  const base = step.consolidation ?? DEFAULT_CONSOLIDATION;
  const o = settings?.consolidationOverride;
  if (!o) return base;
  return {
    qualifyingSessions: o.qualifyingSessions ?? base.qualifyingSessions,
    withinDays: o.withinDays ?? base.withinDays,
  };
}

/**
 * The longest run of qualifying sessions that fits inside the window, ending at the most
 * recent one.
 *
 * Anchoring on the newest qualifying session, rather than counting every qualifying session
 * ever, is what makes the window mean "recently, and repeatedly" instead of "eventually".
 */
function countInWindow(qualifying: Session[], withinDays: number): number {
  if (qualifying.length === 0) return 0;
  const newest = qualifying[qualifying.length - 1]!;
  const cutoff = newest.at - withinDays * MS_PER_DAY;
  return qualifying.filter((s) => s.at >= cutoff).length;
}

export function buildStepProgress(
  step: ProgressionStep,
  setsForStep: readonly LoggedSet[],
  now: Date,
  settings?: UserSettings,
): StepProgress {
  const rule = resolveConsolidation(step, settings);
  const sessions = groupIntoSessions(setsForStep);
  const qualifying = sessions.filter((s) => sessionMeetsStandard(s.sets, step.standard));
  const inWindow = countInWindow(qualifying, rule.withinDays);

  let best: SetValue | undefined = undefined;
  for (const s of sessions) for (const set of s.sets) best = betterValue(best, set.value);

  const lastPracticed = sessions.at(-1);
  const firstQualifying = qualifying[0];
  const daysSincePractice = lastPracticed
    ? (now.getTime() - lastPracticed.at) / MS_PER_DAY
    : Infinity;

  const consolidated = inWindow >= rule.qualifyingSessions;
  const achieved = qualifying.length > 0;
  const stale = consolidated && daysSincePractice > STALE_AFTER_DAYS;

  const attainment: StepProgress["attainment"] = stale
    ? "stale"
    : consolidated
      ? "consolidated"
      : achieved
        ? "achieved"
        : sessions.length > 0
          ? "practising"
          : "untouched";

  return {
    stepId: step.id,
    attainment,
    qualifyingSessions: inWindow,
    needed: rule.qualifyingSessions,
    totalSessions: sessions.length,
    ...(firstQualifying ? { firstAchievedAt: new Date(firstQualifying.at).toISOString() } : {}),
    ...(lastPracticed ? { lastPracticedAt: new Date(lastPracticed.at).toISOString() } : {}),
    ...(best ? { best } : {}),
    reason: reasonFor(attainment, step, inWindow, rule, Math.floor(daysSincePractice)),
  };
}

/**
 * The sentence the user reads. Generated once, here, so the map, the ladder and the legend
 * cannot drift apart -- roadmap-studio produces its `ruleReason` server-side for the same
 * reason.
 */
function reasonFor(
  attainment: StepProgress["attainment"],
  step: ProgressionStep,
  inWindow: number,
  rule: Consolidation,
  daysSincePractice: number,
): string {
  const standard = describeStandard(step.standard);
  switch (attainment) {
    case "untouched":
      return `Not started. Standard: ${standard}.`;
    case "practising":
      return `Practising. Not yet hit ${standard} in a session.`;
    case "achieved":
      return `Hit ${standard} in ${inWindow} of ${rule.qualifyingSessions} sessions needed to consolidate.`;
    case "consolidated":
      return `Consolidated -- ${standard} in ${inWindow} sessions within ${rule.withinDays} days.`;
    case "stale":
      return `Consolidated, but not practised for ${daysSincePractice} days. Worth a refresh.`;
  }
}

/** Is this step strong enough to satisfy a gate of the given strength? */
export function satisfiesGate(
  progress: StepProgress | undefined,
  gate: "achieved" | "consolidated",
): boolean {
  if (!progress) return false;
  // `stale` still counts. Re-locking someone's planche because they took a holiday is
  // punitive; staleness is surfaced as a badge, never as a revoked permission.
  const strong =
    progress.attainment === "consolidated" || progress.attainment === "stale";
  if (gate === "consolidated") return strong;
  return strong || progress.attainment === "achieved";
}
