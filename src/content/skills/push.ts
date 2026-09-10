import { DEFAULT_CONSOLIDATION, type ProgressionStep, type Skill } from "../schema.js";

const s = (
  order: number,
  id: string,
  name: string,
  cue: string,
  why: string,
  standard: ProgressionStep["standard"],
): ProgressionStep => ({
  id: `push/${id}`,
  skillId: "push",
  order,
  name,
  cue,
  why,
  standard,
  consolidation: DEFAULT_CONSOLIDATION,
});

export const push: Skill = {
  id: "push",
  name: "Push and dip",
  branch: "push",
  blurb: "Push-up to dip to straight-bar dip.",
  unlock: { type: "open" },
  steps: [
    s(1, "incline-push-up", "Incline push-up", "Hands elevated, body straight, chest to the surface.", "Lets you own the shape before you own the load.", { kind: "reps", reps: 12, sets: 3 }),
    s(2, "push-up", "Push-up", "Full range, elbows at 45 degrees, no sagging hips.", "The base of every pressing skill above it.", { kind: "reps", reps: 15, sets: 3 }),
    s(3, "parallel-dip", "Parallel bar dip", "Shoulders to elbow height, controlled, no shrug at the top.", "Depth under control is what makes the shoulder safe here.", { kind: "reps", reps: 10, sets: 3 }),
    s(4, "straight-bar-dip", "Straight bar dip", "On a single bar, lean forward slightly, press to a locked support.", "The support position at the top of a muscle-up is exactly this. That is why it gates it.", { kind: "reps", reps: 8, sets: 3 }),
  ],
};
