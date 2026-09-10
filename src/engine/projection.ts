/**
 * The single entry point the UI calls.
 *
 * buildTreeProjection(content, log, overrides, now) -> everything any screen needs.
 * No screen computes state for itself, and nothing anywhere writes it down.
 */

import type { ProgressionStep, StepId, StepRef, TreeContent } from "../content/schema.js";
import { buildStepProgress } from "./attainment.js";
import { evaluateUnlock } from "./unlock.js";
import type {
  LoggedSet,
  ManualOverride,
  SkillAction,
  SkillProjection,
  StepProgress,
  TreeProjection,
  UnlockEdge,
  UnlockResult,
  UserSettings,
} from "./types.js";

export function indexSteps(content: TreeContent): ReadonlyMap<StepId, ProgressionStep> {
  const map = new Map<StepId, ProgressionStep>();
  for (const skill of content.skills) for (const step of skill.steps) map.set(step.id, step);
  return map;
}

function setsByStep(log: readonly LoggedSet[]): ReadonlyMap<StepId, LoggedSet[]> {
  const map = new Map<StepId, LoggedSet[]>();
  for (const set of log) {
    if (set.deletedAt) continue;
    const list = map.get(set.stepId);
    if (list) list.push(set);
    else map.set(set.stepId, [set]);
  }
  return map;
}

/**
 * Collapse the two axes into the one label the UI renders.
 *
 * Ordered by what the athlete can act on, not by how far along they are -- a skill that is
 * unlocked and untouched is more actionable than one that is nearly consolidated, so it
 * reads as `ready_to_start` rather than as a lesser degree of progress.
 */
export function skillActionState(
  unlock: UnlockResult,
  steps: readonly StepProgress[],
): SkillAction {
  if (unlock.status === "locked") return "locked";
  const strong = (p: StepProgress) =>
    p.attainment === "consolidated" || p.attainment === "stale";
  if (steps.every(strong)) {
    return steps.some((p) => p.attainment === "stale") ? "needs_refresh" : "consolidated";
  }
  if (steps.every((p) => p.attainment === "untouched")) return "ready_to_start";
  const current = steps.find((p) => !strong(p));
  if (current?.attainment === "achieved") return "needs_consolidation";
  return "in_progress";
}

export function buildTreeProjection(
  content: TreeContent,
  log: readonly LoggedSet[],
  overrides: readonly ManualOverride[],
  now: Date,
  settings?: UserSettings,
): TreeProjection {
  const stepIndex = indexSteps(content);
  const grouped = setsByStep(log);
  const describeStep = (stepId: StepId) => stepIndex.get(stepId)?.name ?? stepId;

  // Pass 1: per-step attainment. Independent of unlocking -- a log entry counts whether or
  // not the tree thought you were allowed to make it, which keeps honest records of people
  // who could already do things before installing the app.
  const progressByStep = new Map<StepId, StepProgress>();
  for (const skill of content.skills) {
    for (const step of skill.steps) {
      progressByStep.set(
        step.id,
        buildStepProgress(step, grouped.get(step.id) ?? [], now, settings),
      );
    }
  }

  // Pass 2: unlock state, which reads pass 1.
  const skills: SkillProjection[] = content.skills.map((skill) => {
    const unlock = evaluateUnlock(skill, progressByStep, overrides, describeStep);
    const steps = skill.steps
      .filter((s) => !s.retired)
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s) => progressByStep.get(s.id)!);
    const strong = (p: StepProgress) =>
      p.attainment === "consolidated" || p.attainment === "stale";
    const current = unlock.status === "unlocked" ? steps.find((p) => !strong(p)) : undefined;
    return {
      skill,
      unlock,
      action: skillActionState(unlock, steps),
      steps,
      ...(current ? { currentStepId: current.stepId } : {}),
      consolidatedSteps: steps.filter(strong).length,
      totalSteps: steps.length,
    };
  });

  const counts = {
    locked: skills.filter((s) => s.action === "locked").length,
    available: skills.filter((s) => s.action === "ready_to_start").length,
    inProgress: skills.filter(
      (s) => s.action === "in_progress" || s.action === "needs_consolidation",
    ).length,
    consolidated: skills.filter(
      (s) => s.action === "consolidated" || s.action === "needs_refresh",
    ).length,
  };

  // "What do I train today": the current step of every unlocked, unfinished skill, with
  // skills already in progress ahead of ones not yet started.
  const nextUp: StepRef[] = skills
    .filter((s) => s.currentStepId !== undefined)
    .sort((a, b) => rankForNextUp(a) - rankForNextUp(b))
    .map((s) => ({ stepId: s.currentStepId! }));

  return { skills, counts, nextUp };
}

function rankForNextUp(s: SkillProjection): number {
  if (s.action === "needs_consolidation") return 0;
  if (s.action === "in_progress") return 1;
  if (s.action === "needs_refresh") return 2;
  return 3;
}

/**
 * Derive the edges, for rendering only.
 *
 * roadmap-studio's roadmapUnlockGraph.ts is strict about where edges come from, and that
 * strictness is the point: one source of truth per question. Here there is only one source
 * -- the authored rules -- and satisfaction is read from the projection.
 */
export function buildUnlockGraph(
  content: TreeContent,
  projection: TreeProjection,
): UnlockEdge[] {
  const stepIndex = indexSteps(content);
  const progress = new Map<StepId, StepProgress>();
  for (const s of projection.skills) for (const p of s.steps) progress.set(p.stepId, p);

  const edges: UnlockEdge[] = [];
  for (const { skill, unlock } of projection.skills) {
    if (!("requires" in skill.unlock)) continue;
    for (const ref of skill.unlock.requires) {
      const from = stepIndex.get(ref.stepId);
      if (!from) continue; // content-health test catches this; never invent a shape here
      edges.push({
        fromStepId: ref.stepId,
        fromSkillId: from.skillId,
        toSkillId: skill.id,
        gate: ref.at ?? "consolidated",
        satisfied: unlock.satisfiedBy.some((r) => r.stepId === ref.stepId),
      });
    }
  }
  return edges;
}
