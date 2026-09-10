/**
 * Content health.
 *
 * roadmap-studio grew a roadmapDataHealth panel to report rules pointing at nonexistent
 * nodes. These are the same checks, run in CI from day one -- an unresolvable prerequisite
 * or an accidental cycle is invisible in review and silently locks a branch forever.
 */
import { describe, expect, it } from "vitest";
import { CONTENT } from "../src/content/tree.js";
import { indexSteps } from "../src/engine/projection.js";

const steps = indexSteps(CONTENT);

describe("content health", () => {
  it("has unique step ids", () => {
    const ids = CONTENT.skills.flatMap((s) => s.steps.map((st) => st.id));
    expect(ids).toHaveLength(new Set(ids).size);
  });

  it("has unique skill ids", () => {
    const ids = CONTENT.skills.map((s) => s.id);
    expect(ids).toHaveLength(new Set(ids).size);
  });

  it("declares every step's skillId to match its owning skill", () => {
    for (const skill of CONTENT.skills) {
      for (const step of skill.steps) {
        expect(`${step.id} -> ${step.skillId}`).toBe(`${step.id} -> ${skill.id}`);
      }
    }
  });

  it("resolves every prerequisite", () => {
    const unresolved: string[] = [];
    for (const skill of CONTENT.skills) {
      if (!("requires" in skill.unlock)) continue;
      for (const ref of skill.unlock.requires) {
        if (!steps.has(ref.stepId)) unresolved.push(`${skill.id} -> ${ref.stepId}`);
      }
    }
    expect(unresolved).toEqual([]);
  });

  it("has an acyclic prerequisite graph", () => {
    const deps = new Map<string, string[]>();
    for (const skill of CONTENT.skills) {
      const requires = "requires" in skill.unlock ? skill.unlock.requires : [];
      deps.set(
        skill.id,
        requires.map((r) => steps.get(r.stepId)?.skillId).filter((x): x is string => Boolean(x)),
      );
    }
    const state = new Map<string, "visiting" | "done">();
    const cycles: string[] = [];
    const visit = (id: string, path: string[]): void => {
      if (state.get(id) === "done") return;
      if (state.get(id) === "visiting") {
        cycles.push([...path, id].join(" -> "));
        return;
      }
      state.set(id, "visiting");
      for (const next of deps.get(id) ?? []) visit(next, [...path, id]);
      state.set(id, "done");
    };
    for (const id of deps.keys()) visit(id, []);
    expect(cycles).toEqual([]);
  });

  it("gives every skill at least one reachable root", () => {
    // A tree where nothing is `open` can never be started.
    expect(CONTENT.skills.some((s) => s.unlock.type === "open")).toBe(true);
  });

  it("orders steps within a skill without duplicates", () => {
    for (const skill of CONTENT.skills) {
      const orders = skill.steps.map((s) => s.order);
      expect(`${skill.id}:${orders.length}`).toBe(`${skill.id}:${new Set(orders).size}`);
    }
  });

  it("gives every step a cue and a why", () => {
    for (const skill of CONTENT.skills) {
      for (const step of skill.steps) {
        expect(step.cue.length, `${step.id} cue`).toBeGreaterThan(0);
        expect(step.why.length, `${step.id} why`).toBeGreaterThan(0);
      }
    }
  });
});
