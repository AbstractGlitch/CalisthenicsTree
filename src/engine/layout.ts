/**
 * Where each skill sits on the map.
 *
 * roadmap-studio hand-authors x/y percentages, which works there because it has a lecturer
 * drag-editor and a hand-drawn background. This app has neither, so hand-placement would
 * rot the first time a skill is inserted. Depth is the longest path through the
 * prerequisite graph, so a skill always renders to the right of everything it needs.
 *
 * Longest path, not shortest: with the shortest, a skill requiring both a depth-0 and a
 * depth-3 prerequisite would be drawn at depth 1, with an edge running backwards.
 */

import type { SkillId, TreeContent } from "../content/schema.js";
import { indexSteps } from "./projection.js";

export interface SkillPosition {
  skillId: SkillId;
  depth: number;
  lane: number;
  x: number; // percent
  y: number; // percent
}

/** Prerequisite skill ids per skill, resolved through the steps they point at. */
export function skillDependencies(content: TreeContent): Map<SkillId, SkillId[]> {
  const steps = indexSteps(content);
  const deps = new Map<SkillId, SkillId[]>();
  for (const skill of content.skills) {
    const requires = "requires" in skill.unlock ? skill.unlock.requires : [];
    const ids = new Set<SkillId>();
    for (const ref of requires) {
      const owner = steps.get(ref.stepId)?.skillId;
      if (owner && owner !== skill.id) ids.add(owner);
    }
    deps.set(skill.id, [...ids]);
  }
  return deps;
}

export function computeDepths(content: TreeContent): Map<SkillId, number> {
  const deps = skillDependencies(content);
  const depth = new Map<SkillId, number>();
  const visiting = new Set<SkillId>();

  const resolve = (id: SkillId): number => {
    const cached = depth.get(id);
    if (cached !== undefined) return cached;
    // A cycle is a content bug (tests/content.test.ts fails on it). Degrade to 0 rather
    // than recursing forever, so a bad tree still renders something inspectable.
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const parents = deps.get(id) ?? [];
    const d = parents.length === 0 ? 0 : Math.max(...parents.map(resolve)) + 1;
    visiting.delete(id);
    depth.set(id, d);
    return d;
  };

  for (const skill of content.skills) resolve(skill.id);
  return depth;
}

/**
 * Lay the tree out left to right, one column per depth.
 *
 * An authored x/y on a skill wins, so a specific placement can always be forced without
 * giving up automatic placement for everything else.
 */
export function layoutTree(content: TreeContent): SkillPosition[] {
  const depths = computeDepths(content);
  const columns = new Map<number, SkillId[]>();
  for (const skill of content.skills) {
    const d = depths.get(skill.id) ?? 0;
    const col = columns.get(d);
    if (col) col.push(skill.id);
    else columns.set(d, [skill.id]);
  }

  const maxDepth = Math.max(0, ...columns.keys());
  const byId = new Map(content.skills.map((s) => [s.id, s]));

  return content.skills.map((skill) => {
    const depth = depths.get(skill.id) ?? 0;
    const lane = columns.get(depth)!.indexOf(skill.id);
    const laneCount = columns.get(depth)!.length;
    const authored = byId.get(skill.id)!;
    return {
      skillId: skill.id,
      depth,
      lane,
      x: authored.x ?? (maxDepth === 0 ? 50 : 16 + (depth / maxDepth) * 68),
      y: authored.y ?? ((lane + 1) / (laneCount + 1)) * 100,
    };
  });
}
