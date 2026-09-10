import { describe, expect, it } from "vitest";
import { DEFAULT_CONSOLIDATION, type Skill, type StepRef } from "../src/content/schema.js";
import { activeOverrides, evaluateUnlock } from "../src/engine/unlock.js";
import type { ManualOverride, StepProgress } from "../src/engine/types.js";

const progress = (
  stepId: string,
  attainment: StepProgress["attainment"],
): [string, StepProgress] => [
  stepId,
  {
    stepId,
    attainment,
    qualifyingSessions: attainment === "consolidated" ? 3 : 1,
    needed: 3,
    totalSessions: 3,
    reason: "",
  },
];

const skillWith = (unlock: Skill["unlock"], extra: Partial<Skill> = {}): Skill => ({
  id: "target",
  name: "Target",
  branch: "balance",
  blurb: "",
  unlock,
  steps: [
    {
      id: "target/first",
      skillId: "target",
      order: 1,
      name: "First",
      cue: "",
      why: "",
      standard: { kind: "reps", reps: 1 },
      consolidation: DEFAULT_CONSOLIDATION,
    },
  ],
  ...extra,
});

const describeStep = (id: string) => id;
const evaluate = (
  unlock: Skill["unlock"],
  entries: Array<[string, StepProgress]>,
  overrides: ManualOverride[] = [],
  extra: Partial<Skill> = {},
) => evaluateUnlock(skillWith(unlock, extra), new Map(entries), overrides, describeStep);

describe("unlock rules", () => {
  it("open is always unlocked", () => {
    expect(evaluate({ type: "open" }, []).status).toBe("unlocked");
  });

  it("all_of needs every prerequisite", () => {
    const requires: StepRef[] = [{ stepId: "a" }, { stepId: "b" }];
    expect(evaluate({ type: "all_of", requires }, [progress("a", "consolidated")]).status).toBe(
      "locked",
    );
    expect(
      evaluate({ type: "all_of", requires }, [
        progress("a", "consolidated"),
        progress("b", "consolidated"),
      ]).status,
    ).toBe("unlocked");
  });

  it("any_of needs one", () => {
    const requires: StepRef[] = [{ stepId: "a" }, { stepId: "b" }];
    expect(evaluate({ type: "any_of", requires }, [progress("b", "consolidated")]).status).toBe(
      "unlocked",
    );
    expect(evaluate({ type: "any_of", requires }, []).status).toBe("locked");
  });

  it("n_of needs exactly n", () => {
    const requires: StepRef[] = [{ stepId: "a" }, { stepId: "b" }, { stepId: "c" }];
    const two = evaluate({ type: "n_of", n: 2, requires }, [progress("a", "consolidated")]);
    expect(two.status).toBe("locked");
    expect(two.reason).toContain("1 more");
    expect(
      evaluate({ type: "n_of", n: 2, requires }, [
        progress("a", "consolidated"),
        progress("c", "consolidated"),
      ]).status,
    ).toBe("unlocked");
  });

  it("defaults gates to consolidated, and honours an explicit achieved gate", () => {
    const strict: StepRef[] = [{ stepId: "a" }];
    const soft: StepRef[] = [{ stepId: "a", at: "achieved" }];
    expect(evaluate({ type: "all_of", requires: strict }, [progress("a", "achieved")]).status).toBe(
      "locked",
    );
    expect(evaluate({ type: "all_of", requires: soft }, [progress("a", "achieved")]).status).toBe(
      "unlocked",
    );
  });

  it("explains what is missing", () => {
    const r = evaluate({ type: "all_of", requires: [{ stepId: "a" }, { stepId: "b" }] }, []);
    expect(r.reason).toBe("Locked -- needs a, consolidated and b, consolidated.");
  });
});

describe("manual override", () => {
  const grant = (stepId: string, over: Partial<ManualOverride> = {}): ManualOverride => ({
    id: "o1",
    stepId,
    grantedAt: "2026-01-01T00:00:00.000Z",
    reason: "could already do this before installing",
    deviceId: "d1",
    ...over,
  });

  it("unlocks a skill whose prerequisites are unmet", () => {
    const r = evaluate({ type: "all_of", requires: [{ stepId: "a" }] }, [], [
      grant("target/first"),
    ]);
    expect(r.status).toBe("unlocked");
    expect(r.viaManualOverride).toBe(true);
    expect(r.reason).toContain("could already do this");
  });

  it("still reports what remains unmet, so the override is not mistaken for progress", () => {
    const r = evaluate({ type: "all_of", requires: [{ stepId: "a" }] }, [], [
      grant("target/first"),
    ]);
    expect(r.missing.map((m) => m.stepId)).toEqual(["a"]);
    expect(r.satisfiedBy).toEqual([]);
  });

  it("re-locks once revoked", () => {
    const revoked = grant("target/first", {
      revokedAt: "2026-02-01T00:00:00.000Z",
      revocationReason: "granted by mistake",
    });
    const r = evaluate({ type: "all_of", requires: [{ stepId: "a" }] }, [], [revoked]);
    expect(r.status).toBe("locked");
  });

  it("is refused where the skill forbids it", () => {
    const r = evaluate(
      { type: "all_of", requires: [{ stepId: "a" }] },
      [],
      [grant("target/first")],
      { manualUnlockAllowed: false },
    );
    expect(r.status).toBe("locked");
  });

  it("manual_only stays locked without one", () => {
    expect(evaluate({ type: "manual_only" }, []).status).toBe("locked");
    expect(evaluate({ type: "manual_only" }, [], [grant("target/first")]).status).toBe("unlocked");
  });

  it("takes the latest grant/revoke row per step", () => {
    const active = activeOverrides([
      grant("x", { revokedAt: "2026-01-02T00:00:00.000Z" }),
      grant("x", { id: "o2", grantedAt: "2026-01-03T00:00:00.000Z" }),
    ]);
    expect(active.has("x")).toBe(true);
  });
});
