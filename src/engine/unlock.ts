/**
 * May the athlete work on this skill?
 *
 * Prerequisites live on the skill that needs them, exactly as roadmap-studio puts the
 * unlock rule on the node rather than in an edge table. There is no edges collection
 * anywhere in this app; graph.ts derives edges for rendering and throws them away.
 */

import { DEFAULT_GATE, type Skill, type StepRef, type UnlockRule } from "../content/schema.js";
import { satisfiesGate } from "./attainment.js";
import type { ManualOverride, StepProgress, UnlockResult } from "./types.js";

export function gateOf(ref: StepRef): "achieved" | "consolidated" {
  return ref.at ?? DEFAULT_GATE;
}

/** Overrides that are granted and not revoked. */
export function activeOverrides(
  overrides: readonly ManualOverride[],
): ReadonlyMap<string, ManualOverride> {
  const active = new Map<string, ManualOverride>();
  for (const o of overrides) {
    if (o.revokedAt) active.delete(o.stepId);
    else active.set(o.stepId, o);
  }
  return active;
}

function partition(
  requires: readonly StepRef[],
  progressByStep: ReadonlyMap<string, StepProgress>,
): { satisfiedBy: StepRef[]; missing: StepRef[] } {
  const satisfiedBy: StepRef[] = [];
  const missing: StepRef[] = [];
  for (const ref of requires) {
    if (satisfiesGate(progressByStep.get(ref.stepId), gateOf(ref))) satisfiedBy.push(ref);
    else missing.push(ref);
  }
  return { satisfiedBy, missing };
}

/**
 * Evaluate one skill's unlock rule.
 *
 * Precedence mirrors roadmap-studio's projection: an active manual override grants access,
 * but it is checked only after the configured rule, and it can never mark anything
 * achieved or consolidated -- it opens a door, it does not claim you walked through it.
 */
export function evaluateUnlock(
  skill: Skill,
  progressByStep: ReadonlyMap<string, StepProgress>,
  overrides: readonly ManualOverride[],
  describeStep: (stepId: string) => string,
): UnlockResult {
  const rule: UnlockRule = skill.unlock;
  const active = activeOverrides(overrides);
  // An override on any step of this skill opens the skill itself.
  const override = skill.steps.map((s) => active.get(s.id)).find(Boolean);
  const overrideUsable = Boolean(override) && skill.manualUnlockAllowed !== false;

  const grantByOverride = (missing: readonly StepRef[]): UnlockResult => ({
    status: "unlocked",
    satisfiedBy: [],
    missing,
    viaManualOverride: true,
    reason: `Unlocked manually -- ${override?.reason ?? "no reason recorded"}.`,
  });

  if (rule.type === "open") {
    return {
      status: "unlocked",
      satisfiedBy: [],
      missing: [],
      viaManualOverride: false,
      reason: "Open from the start.",
    };
  }

  if (rule.type === "manual_only") {
    if (overrideUsable) return grantByOverride([]);
    return {
      status: "locked",
      satisfiedBy: [],
      missing: [],
      viaManualOverride: false,
      reason: "Opens only by manual unlock.",
    };
  }

  const { satisfiedBy, missing } = partition(rule.requires, progressByStep);
  const needed =
    rule.type === "all_of" ? rule.requires.length : rule.type === "any_of" ? 1 : rule.n;
  const satisfied = satisfiedBy.length >= needed;

  if (satisfied) {
    return {
      status: "unlocked",
      satisfiedBy,
      missing,
      viaManualOverride: false,
      reason: "Prerequisites met.",
    };
  }
  if (overrideUsable) return grantByOverride(missing);

  return {
    status: "locked",
    satisfiedBy,
    missing,
    viaManualOverride: false,
    reason: lockReason(rule, missing, needed - satisfiedBy.length, describeStep),
  };
}

function lockReason(
  rule: Extract<UnlockRule, { requires: readonly StepRef[] }>,
  missing: readonly StepRef[],
  outstanding: number,
  describeStep: (stepId: string) => string,
): string {
  const phrase = (ref: StepRef) =>
    `${describeStep(ref.stepId)}${gateOf(ref) === "achieved" ? "" : ", consolidated"}`;
  const list = missing.map(phrase);
  if (rule.type === "all_of") {
    return `Locked -- needs ${joinAnd(list)}.`;
  }
  if (rule.type === "any_of") {
    return `Locked -- needs any of ${joinOr(list)}.`;
  }
  return `Locked -- needs ${outstanding} more of ${joinOr(list)}.`;
}

function joinAnd(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "nothing";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function joinOr(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "nothing";
  return `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;
}
