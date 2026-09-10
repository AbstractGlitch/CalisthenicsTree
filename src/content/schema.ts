/**
 * The skill-tree content vocabulary.
 *
 * Content is authored, shipped with the app, and versioned. It is strictly separate from
 * user data (see engine/types.ts) -- the same separation magnetic-practice keeps between
 * its CONTENT object and its state S.
 *
 * Two rules govern IDs, and breaking either one silently corrupts historical logs:
 *   1. An ID is permanent. Never renumber, never reuse, never delete -- retire instead.
 *   2. `order` is display position only. It is never identity. (magnetic-practice's ladder
 *      keys on a numeric `level`, which cannot survive an inserted step or a graph.)
 */

export type SkillId = string; // "handstand"
export type StepId = string; // "handstand/chest-to-wall-60"

export type Branch = "push" | "pull" | "core" | "legs" | "balance";

/**
 * What counts as passing a step.
 *
 * A criterion is evaluated against the sets of ONE session, not against a single set:
 * `{ kind: "hold", seconds: 30, sets: 3 }` means three 30-second holds in one session.
 */
export type Criterion =
  | { kind: "hold"; seconds: number; sets?: number }
  | { kind: "reps"; reps: number; sets?: number }
  | { kind: "reps_each_side"; reps: number; sets?: number }
  | { kind: "distance"; metres: number }
  | { kind: "quality"; checklist: readonly string[] };

export type CriterionKind = Criterion["kind"];

/**
 * How many separate sessions turn a one-off into a skill.
 *
 * `withinDays` is what stops three sessions spread over two years from counting: the
 * qualifying sessions have to be recent relative to each other, not merely to exist.
 */
export interface Consolidation {
  qualifyingSessions: number; // default 3
  withinDays: number; // default 21
}

export interface ProgressionStep {
  id: StepId;
  skillId: SkillId;
  order: number; // display only, never identity
  name: string;
  cue: string; // what to actually do
  why: string; // what it builds
  standard: Criterion;
  consolidation: Consolidation;
  /** An easier route to the same place, for people who cannot yet attempt the main step. */
  regressionOf?: StepId;
  /** Retired steps stay in the content forever so old logs still resolve. */
  retired?: boolean;
  demoUrl?: string;
}

/**
 * A prerequisite. `at` is the strength of the gate.
 *
 * Defaults to "consolidated": downstream skills open on repeatable performance, not on a
 * single lucky rep. Use "achieved" deliberately, where a soft gate is the honest one.
 */
export interface StepRef {
  stepId: StepId;
  at?: "achieved" | "consolidated";
}

/**
 * A closed preset vocabulary, deliberately.
 *
 * roadmap-studio's CompletionPolicy docstring rejects "an arbitrary Boolean-expression
 * editor in the domain contract" and it is right: presets stay explainable in one sentence
 * to the person reading a locked node. The divergence here is that roadmap-studio allows
 * only ONE prerequisite per node; a calisthenics tree needs AND/OR, because a planche wants
 * pushing strength AND straight-arm strength.
 */
export type UnlockRule =
  | { type: "open" }
  | { type: "all_of"; requires: readonly StepRef[] }
  | { type: "any_of"; requires: readonly StepRef[] }
  | { type: "n_of"; n: number; requires: readonly StepRef[] }
  | { type: "manual_only" };

export interface Skill {
  id: SkillId;
  name: string;
  branch: Branch;
  blurb: string;
  steps: readonly ProgressionStep[];
  unlock: UnlockRule;
  /** Whether a manual override may open this skill. Default true. */
  manualUnlockAllowed?: boolean;
  /** Optional nudge on top of the computed layered layout. Percentages, 0-100. */
  x?: number;
  y?: number;
}

export interface TreeContent {
  contentVersion: string;
  skills: readonly Skill[];
}

/** Default consolidation, shared by most steps. */
export const DEFAULT_CONSOLIDATION: Consolidation = {
  qualifyingSessions: 3,
  withinDays: 21,
};

/** A step unpracticed for this long shows as stale. Display only -- it never re-locks. */
export const STALE_AFTER_DAYS = 56;

/** Every prerequisite in `requires` that omits `at` is read as this. */
export const DEFAULT_GATE: NonNullable<StepRef["at"]> = "consolidated";
