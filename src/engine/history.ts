/**
 * Per-step training history, derived from the log like everything else.
 *
 * Answers "is this getting better?", which per-session best value does and a raw list of
 * sets does not.
 */

import type { ProgressionStep } from "../content/schema.js";
import { betterValue, sessionMeetsStandard } from "./criterion.js";
import { groupIntoSessions } from "./attainment.js";
import type { LoggedSet, SetValue } from "./types.js";

export interface HistorySession {
  localDate: string;
  at: string; // ISO
  sets: number;
  /** Best single set of the session -- the number worth plotting. */
  best?: SetValue;
  /** Did this session meet the step's standard? */
  qualified: boolean;
}

export interface StepHistory {
  stepId: string;
  sessions: readonly HistorySession[]; // oldest first
  totalSets: number;
  /** All-time best. */
  personalBest?: SetValue;
  /** When the personal best was first reached. */
  personalBestAt?: string;
  /** Comparable numeric series for plotting, aligned with `sessions`. */
  series: readonly number[];
}

/**
 * The single number that represents a value on a chart.
 *
 * Unilateral work scores the weaker side, matching how setMeetsStandard judges it -- a
 * chart that disagreed with the pass/fail rule would be worse than no chart.
 */
export function plottableValue(value: SetValue | undefined): number | undefined {
  if (!value) return undefined;
  switch (value.kind) {
    case "hold":
      return value.seconds;
    case "reps":
      return value.reps;
    case "reps_each_side":
      return Math.min(value.left, value.right);
    case "distance":
      return value.metres;
    case "quality":
      return value.passed ? 1 : 0;
  }
}

export function buildStepHistory(
  step: ProgressionStep,
  setsForStep: readonly LoggedSet[],
): StepHistory {
  const sessions = groupIntoSessions(setsForStep);

  let personalBest: SetValue | undefined;
  let personalBestAt: string | undefined;

  const out: HistorySession[] = sessions.map((s) => {
    let best: SetValue | undefined;
    for (const set of s.sets) best = betterValue(best, set.value);

    // Track the first session that reached the all-time best, so "PR set on 4 March"
    // names the day it was earned rather than the last day it was equalled.
    const previous = plottableValue(personalBest);
    const candidate = plottableValue(best);
    if (best && (previous === undefined || (candidate !== undefined && candidate > previous))) {
      personalBest = best;
      personalBestAt = new Date(s.at).toISOString();
    }

    return {
      localDate: s.localDate,
      at: new Date(s.at).toISOString(),
      sets: s.sets.length,
      ...(best ? { best } : {}),
      qualified: sessionMeetsStandard(s.sets, step.standard),
    };
  });

  return {
    stepId: step.id,
    sessions: out,
    totalSets: sessions.reduce((n, s) => n + s.sets.length, 0),
    ...(personalBest ? { personalBest } : {}),
    ...(personalBestAt ? { personalBestAt } : {}),
    series: out.map((s) => plottableValue(s.best) ?? 0),
  };
}
