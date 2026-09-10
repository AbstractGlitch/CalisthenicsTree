/**
 * Does performance meet a standard?
 *
 * Pure, no clock, no I/O. Everything upstream of consolidation reduces to these two
 * questions: did this set clear the bar, and did this session clear it enough times?
 */

import type { Criterion } from "../content/schema.js";
import type { LoggedSet, SetValue } from "./types.js";

/** Sets required in one session. Absent means one. */
export function setsRequired(standard: Criterion): number {
  return "sets" in standard && standard.sets !== undefined ? standard.sets : 1;
}

/**
 * Does one set clear the bar?
 *
 * A value of the wrong shape never passes -- it is a logging bug, not a near miss.
 * Comparisons are >=, so a standard of 30s is met by exactly 30.0s and missed by 29.9s.
 */
export function setMeetsStandard(set: LoggedSet, standard: Criterion): boolean {
  if (set.deletedAt) return false;
  const v: SetValue = set.value;
  switch (standard.kind) {
    case "hold":
      return v.kind === "hold" && v.seconds >= standard.seconds;
    case "reps":
      return v.kind === "reps" && v.reps >= standard.reps;
    case "reps_each_side":
      // The weaker side is the score. Averaging would let a strong side carry a weak one,
      // which is exactly the asymmetry these steps exist to find.
      return v.kind === "reps_each_side" && Math.min(v.left, v.right) >= standard.reps;
    case "distance":
      return v.kind === "distance" && v.metres >= standard.metres;
    case "quality":
      // Every checklist item must be ticked AND the attempt marked passed, so a
      // half-remembered self-assessment does not quietly count.
      return (
        v.kind === "quality" &&
        v.passed &&
        standard.checklist.every((item) => v.checked.includes(item))
      );
  }
}

/**
 * Did one session clear the bar? `sets: 3` means three qualifying sets that session.
 *
 * Callers must pass the sets of a single session for a single step; grouping is the
 * caller's job (see attainment.ts).
 */
export function sessionMeetsStandard(sets: readonly LoggedSet[], standard: Criterion): boolean {
  const qualifying = sets.filter((s) => setMeetsStandard(s, standard)).length;
  return qualifying >= setsRequired(standard);
}

/** The best of two values of the same kind, for PR tracking. Mixed kinds keep `a`. */
export function betterValue(a: SetValue | undefined, b: SetValue): SetValue {
  if (!a) return b;
  if (a.kind !== b.kind) return a;
  switch (a.kind) {
    case "hold":
      return b.kind === "hold" && b.seconds > a.seconds ? b : a;
    case "reps":
      return b.kind === "reps" && b.reps > a.reps ? b : a;
    case "reps_each_side":
      return b.kind === "reps_each_side" &&
        Math.min(b.left, b.right) > Math.min(a.left, a.right)
        ? b
        : a;
    case "distance":
      return b.kind === "distance" && b.metres > a.metres ? b : a;
    case "quality":
      return b.kind === "quality" && b.passed && !a.passed ? b : a;
  }
}

/** Human phrasing of a standard, e.g. "3 x 30s hold". Used in reason sentences and the UI. */
export function describeStandard(standard: Criterion): string {
  const n = setsRequired(standard);
  const prefix = n > 1 ? `${n} x ` : "";
  switch (standard.kind) {
    case "hold":
      return `${prefix}${standard.seconds}s hold`;
    case "reps":
      return `${prefix}${standard.reps} reps`;
    case "reps_each_side":
      return `${prefix}${standard.reps} reps each side`;
    case "distance":
      return `${standard.metres}m`;
    case "quality":
      return `form check (${standard.checklist.length} points)`;
  }
}
