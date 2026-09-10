import { DEFAULT_CONSOLIDATION, type ProgressionStep, type Skill } from "../schema.js";

const mk =
  (skillId: string) =>
  (
    order: number,
    id: string,
    name: string,
    cue: string,
    why: string,
    standard: ProgressionStep["standard"],
  ): ProgressionStep => ({
    id: `${skillId}/${id}`,
    skillId,
    order,
    name,
    cue,
    why,
    standard,
    consolidation: DEFAULT_CONSOLIDATION,
  });

const s = mk("pull");
export const pull: Skill = {
  id: "pull",
  name: "Pull-up",
  branch: "pull",
  blurb: "Row, then hang, then pull.",
  unlock: { type: "open" },
  steps: [
    s(1, "australian-row", "Australian row", "Bar at hip height, body straight, chest to bar.", "Horizontal pulling first -- it builds the scapular control that stops a pull-up becoming an elbow exercise.", { kind: "reps", reps: 10, sets: 3 }),
    s(2, "dead-hang", "Dead hang", "Full hang, shoulders active, breathe.", "Grip and shoulder tolerance. Nothing above this works if the hang does not.", { kind: "hold", seconds: 45 }),
    s(3, "negative-pull-up", "Negative pull-up", "Jump to the top, lower for five seconds.", "The eccentric builds the strength the concentric cannot yet reach.", { kind: "reps", reps: 5, sets: 3 }),
    s(4, "pull-up", "Pull-up", "Chin over bar, no kip, full extension at the bottom.", "The benchmark. Strict, because everything above it assumes strict.", { kind: "reps", reps: 8, sets: 3 }),
  ],
};

const m = mk("muscle-up");
export const muscleUp: Skill = {
  id: "muscle-up",
  name: "Muscle-up",
  branch: "pull",
  // The cross-branch prerequisite: this needs pulling AND pushing, which is exactly the
  // AND-of-two-branches case a single-prerequisite model cannot express.
  unlock: {
    type: "all_of",
    requires: [{ stepId: "pull/pull-up" }, { stepId: "push/straight-bar-dip" }],
  },
  blurb: "Pull high, turn over, press out. Needs both halves.",
  steps: [
    m(1, "high-pull", "Explosive high pull", "Pull to sternum height on a straight bar.", "You cannot turn over below the bar. Height comes first.", { kind: "reps", reps: 5, sets: 3 }),
    m(2, "transition-drill", "Transition drill", "From a low bar, practise the turnover slowly with feet assisting.", "The transition is a skill, not a strength problem. Drilling it slowly is faster than muscling it.", { kind: "reps", reps: 5, sets: 3 }),
    m(3, "muscle-up", "Muscle-up", "Pull, turn over, press to support. No kip.", "The whole movement, strict.", { kind: "reps", reps: 3 }),
  ],
};
