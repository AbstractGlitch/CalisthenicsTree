import { describe, expect, it } from "vitest";
import { CONTENT } from "../src/content/tree.js";
import { computeDepths, layoutTree, skillDependencies } from "../src/engine/layout.js";

describe("layout", () => {
  const depths = computeDepths(CONTENT);

  it("puts roots at depth 0", () => {
    expect(depths.get("foundations")).toBe(0);
    expect(depths.get("push")).toBe(0);
    expect(depths.get("pull")).toBe(0);
  });

  it("places a skill after everything it needs", () => {
    expect(depths.get("handstand")).toBe(1);
    expect(depths.get("muscle-up")).toBe(1);
  });

  it("resolves prerequisites through steps to owning skills", () => {
    expect(skillDependencies(CONTENT).get("muscle-up")?.sort()).toEqual(["pull", "push"]);
  });

  it("uses the longest path so no edge ever runs backwards", () => {
    const content = {
      contentVersion: "t",
      skills: [
        { id: "a", name: "A", branch: "core", blurb: "", unlock: { type: "open" }, steps: [
          { id: "a/1", skillId: "a", order: 1, name: "", cue: "", why: "",
            standard: { kind: "reps", reps: 1 },
            consolidation: { qualifyingSessions: 1, withinDays: 7 } },
        ] },
        { id: "b", name: "B", branch: "core", blurb: "",
          unlock: { type: "all_of", requires: [{ stepId: "a/1" }] }, steps: [
          { id: "b/1", skillId: "b", order: 1, name: "", cue: "", why: "",
            standard: { kind: "reps", reps: 1 },
            consolidation: { qualifyingSessions: 1, withinDays: 7 } },
        ] },
        // c needs both the depth-0 a and the depth-1 b -- shortest path would place it at 1,
        // level with its own prerequisite.
        { id: "c", name: "C", branch: "core", blurb: "",
          unlock: { type: "all_of", requires: [{ stepId: "a/1" }, { stepId: "b/1" }] }, steps: [
          { id: "c/1", skillId: "c", order: 1, name: "", cue: "", why: "",
            standard: { kind: "reps", reps: 1 },
            consolidation: { qualifyingSessions: 1, withinDays: 7 } },
        ] },
      ],
    } as const;
    const d = computeDepths(content as never);
    expect(d.get("c")).toBe(2);
  });

  it("gives every skill a position inside the canvas", () => {
    for (const p of layoutTree(CONTENT)) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(100);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(100);
    }
  });

  it("separates skills sharing a column", () => {
    const positions = layoutTree(CONTENT);
    const roots = positions.filter((p) => p.depth === 0).map((p) => p.y);
    expect(new Set(roots).size).toBe(roots.length);
  });
});
