/**
 * The golden test: a scripted training history against the real seeded tree.
 *
 * This is the regression net for the engine as a whole -- any change to criterion,
 * attainment, unlock or projection that alters real-world behaviour shows up here.
 */
import { describe, expect, it } from "vitest";
import { CONTENT } from "../src/content/tree.js";
import { buildTreeProjection, buildUnlockGraph } from "../src/engine/projection.js";
import type { LoggedSet, ManualOverride } from "../src/engine/types.js";
import { hold, reps, session } from "./helpers.js";

const at = (d: string) => new Date(`${d}T18:00:00.000Z`);
const find = (p: ReturnType<typeof buildTreeProjection>, id: string) =>
  p.skills.find((s) => s.skill.id === id)!;

/** Three qualifying sessions a week apart -- enough to consolidate. */
function consolidate(stepId: string, value: LoggedSet["value"], start: string, sets = 1) {
  const d = new Date(`${start}T12:00:00.000Z`);
  const out: LoggedSet[] = [];
  for (let i = 0; i < 3; i++) {
    const date = new Date(d.getTime() + i * 7 * 86_400_000).toISOString().slice(0, 10);
    out.push(...session(stepId, date, value, sets));
  }
  return out;
}

describe("a cold start", () => {
  const p = buildTreeProjection(CONTENT, [], [], at("2026-01-01"));

  it("opens only the root skills", () => {
    expect(find(p, "foundations").unlock.status).toBe("unlocked");
    expect(find(p, "push").unlock.status).toBe("unlocked");
    expect(find(p, "pull").unlock.status).toBe("unlocked");
    expect(find(p, "handstand").unlock.status).toBe("locked");
    expect(find(p, "muscle-up").unlock.status).toBe("locked");
  });

  it("reads as ready to start, not in progress", () => {
    expect(find(p, "foundations").action).toBe("ready_to_start");
  });

  it("explains the lock in a sentence naming the missing work", () => {
    expect(find(p, "handstand").unlock.reason).toContain("Hollow body hold");
  });

  it("suggests the first step of each open skill", () => {
    expect(p.nextUp.map((r) => r.stepId)).toContain("foundations/wrist-prep");
  });

  it("counts correctly", () => {
    expect(p.counts.available).toBe(3);
    expect(p.counts.locked).toBe(2);
  });
});

describe("after clearing the foundations", () => {
  const log: LoggedSet[] = [
    ...consolidate(
      "foundations/wrist-prep",
      { kind: "quality", checked: [
        "No sharp pain at any point",
        "Full range front and back",
        "Both directions, unhurried",
      ], passed: true },
      "2026-01-01",
    ),
    ...consolidate("foundations/hollow-hold", hold(50), "2026-01-01"),
    ...consolidate("foundations/pike-push-up", reps(8), "2026-01-01", 3),
  ];
  const p = buildTreeProjection(CONTENT, log, [], at("2026-01-20"));

  it("unlocks the handstand", () => {
    expect(find(p, "handstand").unlock.status).toBe("unlocked");
    expect(find(p, "handstand").unlock.viaManualOverride).toBe(false);
  });

  it("marks foundations consolidated", () => {
    expect(find(p, "foundations").action).toBe("consolidated");
    expect(find(p, "foundations").consolidatedSteps).toBe(3);
  });

  it("points at the first handstand step", () => {
    expect(find(p, "handstand").currentStepId).toBe("handstand/wall-plank");
  });

  it("leaves the muscle-up locked -- it needs the other branches", () => {
    expect(find(p, "muscle-up").unlock.status).toBe("locked");
  });
});

describe("the pike push-up set requirement", () => {
  // The standard is 3 x 8. One set of 8, three weeks running, must not consolidate it.
  const oneSet = consolidate("foundations/pike-push-up", reps(8), "2026-01-01", 1);
  const p = buildTreeProjection(CONTENT, oneSet, [], at("2026-01-20"));

  it("is not met by a single set", () => {
    const step = find(p, "foundations").steps.find(
      (s) => s.stepId === "foundations/pike-push-up",
    )!;
    expect(step.attainment).toBe("practising");
  });
});

describe("the cross-branch prerequisite", () => {
  const pullOnly = [
    ...consolidate("pull/australian-row", reps(10), "2026-01-01", 3),
    ...consolidate("pull/dead-hang", hold(45), "2026-01-01"),
    ...consolidate("pull/negative-pull-up", reps(5), "2026-01-01", 3),
    ...consolidate("pull/pull-up", reps(8), "2026-01-01", 3),
  ];

  it("stays locked on pulling strength alone", () => {
    const p = buildTreeProjection(CONTENT, pullOnly, [], at("2026-01-20"));
    const mu = find(p, "muscle-up");
    expect(mu.unlock.status).toBe("locked");
    expect(mu.unlock.satisfiedBy.map((r) => r.stepId)).toEqual(["pull/pull-up"]);
    expect(mu.unlock.missing.map((r) => r.stepId)).toEqual(["push/straight-bar-dip"]);
  });

  it("opens once the pushing half arrives too", () => {
    const both = [
      ...pullOnly,
      ...consolidate("push/straight-bar-dip", reps(8), "2026-01-01", 3),
    ];
    const p = buildTreeProjection(CONTENT, both, [], at("2026-01-20"));
    expect(find(p, "muscle-up").unlock.status).toBe("unlocked");
  });
});

describe("a manual override", () => {
  const override: ManualOverride = {
    id: "o1",
    stepId: "handstand/wall-plank",
    grantedAt: "2026-01-01T00:00:00.000Z",
    reason: "already held a 60s chest-to-wall before installing",
    deviceId: "d1",
  };
  const p = buildTreeProjection(CONTENT, [], [override], at("2026-01-10"));

  it("opens the skill", () => {
    expect(find(p, "handstand").unlock.status).toBe("unlocked");
    expect(find(p, "handstand").unlock.viaManualOverride).toBe(true);
  });

  it("does not fabricate progress", () => {
    expect(find(p, "handstand").consolidatedSteps).toBe(0);
    expect(find(p, "handstand").action).toBe("ready_to_start");
  });
});

describe("staleness", () => {
  const log = consolidate("foundations/hollow-hold", hold(50), "2026-01-01");

  it("flags a long-untrained step without re-locking anything", () => {
    const p = buildTreeProjection(CONTENT, log, [], at("2026-09-01"));
    const step = find(p, "foundations").steps.find(
      (s) => s.stepId === "foundations/hollow-hold",
    )!;
    expect(step.attainment).toBe("stale");
    // The hollow hold still counts towards the handstand gate.
    const hs = find(p, "handstand");
    expect(hs.unlock.satisfiedBy.map((r) => r.stepId)).toContain("foundations/hollow-hold");
  });
});

describe("buildUnlockGraph", () => {
  const p = buildTreeProjection(CONTENT, [], [], at("2026-01-01"));
  const edges = buildUnlockGraph(CONTENT, p);

  it("derives one edge per prerequisite", () => {
    expect(edges.filter((e) => e.toSkillId === "handstand")).toHaveLength(3);
    expect(edges.filter((e) => e.toSkillId === "muscle-up")).toHaveLength(2);
  });

  it("resolves the source skill of each edge", () => {
    const mu = edges.filter((e) => e.toSkillId === "muscle-up").map((e) => e.fromSkillId).sort();
    expect(mu).toEqual(["pull", "push"]);
  });

  it("carries the gate strength for rendering", () => {
    const soft = edges.find((e) => e.fromStepId === "foundations/wrist-prep")!;
    expect(soft.gate).toBe("achieved");
  });

  it("marks nothing satisfied on a cold start", () => {
    expect(edges.every((e) => !e.satisfied)).toBe(true);
  });
});
