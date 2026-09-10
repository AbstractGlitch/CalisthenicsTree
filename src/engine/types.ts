/**
 * User data, and the states derived from it.
 *
 * The log is append-only and every row is immutable. Nothing here stores "unlocked" or
 * "done" -- those are computed by projection.ts on every read. That is the central
 * architectural rule of this app, and it is what roadmap-studio does
 * (backend/app/student_roadmap_projection.py: node state is computed, never persisted).
 */

import type { StepId, SkillId, StepRef, Skill, CriterionKind } from "../content/schema.js";

export type SetValue =
  | { kind: "hold"; seconds: number }
  | { kind: "reps"; reps: number }
  | { kind: "reps_each_side"; left: number; right: number }
  | { kind: "distance"; metres: number }
  | { kind: "quality"; checked: readonly string[]; passed: boolean };

/**
 * One set, as performed.
 *
 * Fields marked [sync] exist so a sync server can be added later without a data migration.
 * Because rows are immutable, uuid-keyed, and deleted only by tombstone, syncing is a set
 * union keyed by `id` -- there is no conflict resolution to write. That is the whole reason
 * choosing "no server" today costs nothing tomorrow.
 */
export interface LoggedSet {
  id: string; // uuid                                    [sync key]
  stepId: StepId;
  sessionId: string; // uuid, groups sets performed together
  performedAt: string; // ISO 8601 with offset
  /**
   * The calendar date in the user's timezone AT LOG TIME, "YYYY-MM-DD".
   *
   * Stored rather than derived: day bucketing decides consolidation, and it must not shift
   * retroactively when the user flies somewhere. A set logged at 11pm in Berlin stays on
   * that Berlin day forever.
   */
  localDate: string;
  value: SetValue;
  rpe?: number; // 1-10
  note?: string;
  deletedAt?: string; // tombstone, never hard-delete     [sync]
  contentVersion: string; // tree version live when logged
  deviceId: string; // uuid per install                   [sync]
}

/**
 * A manual unlock.
 *
 * roadmap-studio's override layer, minus the tenancy: an override never mutates the
 * authored unlock rule, so revoking restores the original gate automatically. A reason is
 * mandatory on both grant and revoke -- an override you cannot explain later is an override
 * you should not have granted.
 */
export interface ManualOverride {
  id: string;
  stepId: StepId;
  grantedAt: string;
  reason: string; // required
  revokedAt?: string;
  revocationReason?: string;
  deviceId: string;
}

export interface UserSettings {
  schemaVersion: number;
  deviceId: string;
  /** Overrides the per-step consolidation defaults, for people who want a stricter bar. */
  consolidationOverride?: { qualifyingSessions?: number; withinDays?: number };
  createdAt: string;
}

/* ------------------------------------------------------------------ derived state ---- */

/**
 * Axis 1 of 2: how far through this step am I?
 *
 * "achieved" means the standard was met in one session. "consolidated" means it was met in
 * enough separate sessions, recently enough, to be a skill rather than an incident.
 */
export type StepAttainment =
  | "untouched"
  | "practising"
  | "achieved"
  | "consolidated"
  | "stale";

export interface StepProgress {
  stepId: StepId;
  attainment: StepAttainment;
  /** Qualifying sessions inside the consolidation window. */
  qualifyingSessions: number;
  needed: number;
  totalSessions: number;
  firstAchievedAt?: string;
  lastPracticedAt?: string;
  best?: SetValue;
  /** A sentence fit to show the user. Produced here so no two screens can disagree. */
  reason: string;
}

/** Axis 2 of 2: may I work on this at all? */
export interface UnlockResult {
  status: "locked" | "unlocked";
  satisfiedBy: readonly StepRef[];
  missing: readonly StepRef[];
  viaManualOverride: boolean;
  reason: string;
}

/**
 * The two axes collapsed into the one label the UI actually renders, ordered by what the
 * user can act on rather than by how far along they are. One source for colour, aria-label
 * and legend text -- lifted from roadmap-studio's frontend/src/lib/roadmapNodeState.ts.
 */
export type SkillAction =
  | "locked"
  | "ready_to_start"
  | "in_progress"
  | "needs_consolidation"
  | "consolidated"
  | "needs_refresh";

export interface SkillProjection {
  skill: Skill;
  unlock: UnlockResult;
  action: SkillAction;
  steps: readonly StepProgress[];
  /** The step to work on now: first not-yet-consolidated step, if the skill is unlocked. */
  currentStepId?: StepId;
  consolidatedSteps: number;
  totalSteps: number;
}

export interface TreeProjection {
  skills: readonly SkillProjection[];
  counts: {
    locked: number;
    available: number;
    inProgress: number;
    consolidated: number;
  };
  /** The "what do I train today" answer. */
  nextUp: readonly StepRef[];
}

/** An edge, derived for rendering. Never stored. */
export interface UnlockEdge {
  fromStepId: StepId;
  fromSkillId: SkillId;
  toSkillId: SkillId;
  gate: NonNullable<StepRef["at"]>;
  satisfied: boolean;
}

/** Runtime guard: does a logged value match the shape the step's standard expects? */
export function valueMatchesKind(value: SetValue, kind: CriterionKind): boolean {
  if (kind === "quality") return value.kind === "quality";
  return value.kind === kind;
}
