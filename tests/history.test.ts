import { describe, expect, it } from "vitest";
import { DEFAULT_CONSOLIDATION, type ProgressionStep } from "../src/content/schema.js";
import { buildStepHistory, plottableValue } from "../src/engine/history.js";
import { eachSide, hold, session, set } from "./helpers.js";

const step: ProgressionStep = {
  id: "handstand/chest-to-wall-60", skillId: "handstand", order: 1,
  name: "Chest-to-wall", cue: "", why: "",
  standard: { kind: "hold", seconds: 60 },
  consolidation: DEFAULT_CONSOLIDATION,
};

describe("plottableValue", () => {
  it("scores the weaker side, matching how the standard is judged", () => {
    expect(plottableValue(eachSide(12, 5))).toBe(5);
  });
  it("is undefined for nothing", () => {
    expect(plottableValue(undefined)).toBeUndefined();
  });
});

describe("buildStepHistory", () => {
  const log = [
    ...session("s", "2026-01-01", hold(30), 2),
    ...session("s", "2026-01-05", hold(52)),
    ...session("s", "2026-01-09", hold(44)),
    ...session("s", "2026-01-14", hold(61)),
  ];
  const h = buildStepHistory(step, log);

  it("returns one entry per session, oldest first", () => {
    expect(h.sessions.map((s) => s.localDate)).toEqual([
      "2026-01-01", "2026-01-05", "2026-01-09", "2026-01-14",
    ]);
  });

  it("takes the best set of each session", () => {
    expect(h.series).toEqual([30, 52, 44, 61]);
  });

  it("counts every set, not just qualifying ones", () => {
    expect(h.totalSets).toBe(5);
  });

  it("marks which sessions met the standard", () => {
    expect(h.sessions.map((s) => s.qualified)).toEqual([false, false, false, true]);
  });

  it("tracks the personal best", () => {
    expect(h.personalBest).toEqual(hold(61));
  });

  it("dates the PR to when it was first reached, not last equalled", () => {
    const equalled = buildStepHistory(step, [
      ...session("s", "2026-01-01", hold(40)),
      ...session("s", "2026-02-01", hold(40)),
    ]);
    expect(equalled.personalBestAt?.slice(0, 10)).toBe("2026-01-01");
  });

  it("ignores tombstoned sets", () => {
    const withDeleted = buildStepHistory(step, [
      ...session("s", "2026-01-01", hold(30)),
      set("s", "2026-01-05", hold(99), { deletedAt: "2026-01-06T00:00:00.000Z" }),
    ]);
    expect(withDeleted.series).toEqual([30]);
    expect(withDeleted.personalBest).toEqual(hold(30));
  });

  it("is empty for an untouched step", () => {
    const empty = buildStepHistory(step, []);
    expect(empty.sessions).toEqual([]);
    expect(empty.personalBest).toBeUndefined();
    expect(empty.totalSets).toBe(0);
  });
});
