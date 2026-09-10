import { describe, expect, it } from "vitest";
import { DEFAULT_CONSOLIDATION, type ProgressionStep } from "../src/content/schema.js";
import { buildStepProgress, groupIntoSessions, satisfiesGate } from "../src/engine/attainment.js";
import { hold, session, set } from "./helpers.js";

const step: ProgressionStep = {
  id: "handstand/chest-to-wall-60",
  skillId: "handstand",
  order: 1,
  name: "Chest-to-wall handstand",
  cue: "",
  why: "",
  standard: { kind: "hold", seconds: 60 },
  consolidation: DEFAULT_CONSOLIDATION, // 3 sessions within 21 days
};

const at = (d: string) => new Date(`${d}T12:00:00.000Z`);

describe("groupIntoSessions", () => {
  it("buckets by calendar day, not by sessionId", () => {
    // Two separate sessionIds on one day -- an app restart mid-workout, or a morning and
    // an evening session. If these counted twice, three qualifying sets in one afternoon
    // would consolidate a skill on the spot.
    const sets = [
      set("s", "2026-01-01", hold(60), { sessionId: "morning" }),
      set("s", "2026-01-01", hold(60), { sessionId: "evening" }),
    ];
    expect(groupIntoSessions(sets)).toHaveLength(1);
  });

  it("drops tombstoned sets", () => {
    const sets = [
      set("s", "2026-01-01", hold(60)),
      set("s", "2026-01-02", hold(60), { deletedAt: "2026-01-03T00:00:00.000Z" }),
    ];
    expect(groupIntoSessions(sets)).toHaveLength(1);
  });
});

describe("consolidation", () => {
  it("is achieved but not consolidated after one qualifying session", () => {
    const p = buildStepProgress(step, session("s", "2026-01-01", hold(60)), at("2026-01-02"));
    expect(p.attainment).toBe("achieved");
    expect(p.qualifyingSessions).toBe(1);
    expect(p.needed).toBe(3);
  });

  it("consolidates on three qualifying sessions inside the window", () => {
    const log = [
      ...session("s", "2026-01-01", hold(60)),
      ...session("s", "2026-01-08", hold(60)),
      ...session("s", "2026-01-15", hold(60)),
    ];
    const p = buildStepProgress(step, log, at("2026-01-16"));
    expect(p.attainment).toBe("consolidated");
    expect(p.qualifyingSessions).toBe(3);
  });

  it("does NOT consolidate three sessions spread beyond the window", () => {
    // The whole point of withinDays: repeatable now, not eventually.
    const log = [
      ...session("s", "2026-01-01", hold(60)),
      ...session("s", "2026-02-15", hold(60)),
      ...session("s", "2026-04-01", hold(60)),
    ];
    const p = buildStepProgress(step, log, at("2026-04-02"));
    expect(p.attainment).toBe("achieved");
    expect(p.qualifyingSessions).toBe(1);
  });

  it("counts only sessions that met the standard", () => {
    const log = [
      ...session("s", "2026-01-01", hold(60)),
      ...session("s", "2026-01-03", hold(20)),
      ...session("s", "2026-01-05", hold(20)),
    ];
    const p = buildStepProgress(step, log, at("2026-01-06"));
    expect(p.attainment).toBe("achieved");
    expect(p.qualifyingSessions).toBe(1);
    expect(p.totalSessions).toBe(3);
  });

  it("reports practising when the step is worked but never met", () => {
    const p = buildStepProgress(step, session("s", "2026-01-01", hold(15)), at("2026-01-02"));
    expect(p.attainment).toBe("practising");
  });

  it("tracks the best value as a PR", () => {
    const log = [
      ...session("s", "2026-01-01", hold(31)),
      ...session("s", "2026-01-03", hold(52)),
      ...session("s", "2026-01-05", hold(44)),
    ];
    expect(buildStepProgress(step, log, at("2026-01-06")).best).toEqual(hold(52));
  });
});

describe("staleness", () => {
  const consolidated = [
    ...session("s", "2026-01-01", hold(60)),
    ...session("s", "2026-01-08", hold(60)),
    ...session("s", "2026-01-15", hold(60)),
  ];

  it("marks a long-untrained consolidated step stale", () => {
    const p = buildStepProgress(step, consolidated, at("2026-06-01"));
    expect(p.attainment).toBe("stale");
  });

  it("still satisfies gates when stale -- staleness never re-locks", () => {
    const p = buildStepProgress(step, consolidated, at("2026-06-01"));
    expect(satisfiesGate(p, "consolidated")).toBe(true);
    expect(satisfiesGate(p, "achieved")).toBe(true);
  });
});

describe("satisfiesGate", () => {
  it("separates the two gate strengths", () => {
    const achieved = buildStepProgress(step, session("s", "2026-01-01", hold(60)), at("2026-01-02"));
    expect(satisfiesGate(achieved, "achieved")).toBe(true);
    expect(satisfiesGate(achieved, "consolidated")).toBe(false);
  });

  it("is false for an unknown step", () => {
    expect(satisfiesGate(undefined, "achieved")).toBe(false);
  });
});
