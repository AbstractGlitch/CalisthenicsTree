import { describe, expect, it } from "vitest";
import {
  betterValue,
  describeStandard,
  sessionMeetsStandard,
  setMeetsStandard,
} from "../src/engine/criterion.js";
import { eachSide, hold, reps, session, set } from "./helpers.js";

describe("setMeetsStandard", () => {
  it("treats the standard as inclusive", () => {
    const std = { kind: "hold", seconds: 30 } as const;
    expect(setMeetsStandard(set("s", "2026-01-01", hold(30)), std)).toBe(true);
    expect(setMeetsStandard(set("s", "2026-01-01", hold(29.9)), std)).toBe(false);
  });

  it("scores the weaker side on unilateral work", () => {
    const std = { kind: "reps_each_side", reps: 8 } as const;
    expect(setMeetsStandard(set("s", "2026-01-01", eachSide(12, 5)), std)).toBe(false);
    expect(setMeetsStandard(set("s", "2026-01-01", eachSide(8, 8)), std)).toBe(true);
  });

  it("rejects a value of the wrong shape rather than coercing it", () => {
    const std = { kind: "hold", seconds: 10 } as const;
    expect(setMeetsStandard(set("s", "2026-01-01", reps(100)), std)).toBe(false);
  });

  it("ignores tombstoned sets", () => {
    const s = set("s", "2026-01-01", hold(60), { deletedAt: "2026-01-02T00:00:00.000Z" });
    expect(setMeetsStandard(s, { kind: "hold", seconds: 30 })).toBe(false);
  });

  it("requires every checklist item and an explicit pass", () => {
    const std = { kind: "quality", checklist: ["a", "b"] } as const;
    const passing = set("s", "2026-01-01", { kind: "quality", checked: ["a", "b"], passed: true });
    const partial = set("s", "2026-01-01", { kind: "quality", checked: ["a"], passed: true });
    const unpassed = set("s", "2026-01-01", { kind: "quality", checked: ["a", "b"], passed: false });
    expect(setMeetsStandard(passing, std)).toBe(true);
    expect(setMeetsStandard(partial, std)).toBe(false);
    expect(setMeetsStandard(unpassed, std)).toBe(false);
  });
});

describe("sessionMeetsStandard", () => {
  const std = { kind: "hold", seconds: 30, sets: 3 } as const;

  it("needs the full set count in one session", () => {
    expect(sessionMeetsStandard(session("s", "2026-01-01", hold(30), 2), std)).toBe(false);
    expect(sessionMeetsStandard(session("s", "2026-01-01", hold(30), 3), std)).toBe(true);
  });

  it("counts only the sets that clear the bar", () => {
    const mixed = [
      ...session("s", "2026-01-01", hold(30), 2),
      ...session("s", "2026-01-01", hold(12), 4),
    ];
    expect(sessionMeetsStandard(mixed, std)).toBe(false);
  });
});

describe("betterValue", () => {
  it("keeps the larger of two comparable values", () => {
    expect(betterValue(hold(20), hold(35))).toEqual(hold(35));
    expect(betterValue(hold(40), hold(35))).toEqual(hold(40));
  });
  it("does not compare across kinds", () => {
    expect(betterValue(hold(20), reps(99))).toEqual(hold(20));
  });
});

describe("describeStandard", () => {
  it("reads like a coach wrote it", () => {
    expect(describeStandard({ kind: "hold", seconds: 30, sets: 3 })).toBe("3 x 30s hold");
    expect(describeStandard({ kind: "hold", seconds: 60 })).toBe("60s hold");
    expect(describeStandard({ kind: "distance", metres: 10 })).toBe("10m");
  });
});
