import { DEFAULT_CONSOLIDATION, type ProgressionStep, type Skill } from "../schema.js";

/**
 * Step factory bound to one skill.
 *
 * Bound per skill rather than shared: an id prefix that does not match its owning skill is
 * invisible in review and silently breaks every prerequisite pointing at it.
 */
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

/**
 * The seeded skill, authored in full.
 *
 * Standards are the conventional ones: a 60s chest-to-wall hold before coming off the wall,
 * and toe pulls before free balance. The wall work is not a warm-up for the real thing --
 * it is where the line gets built, and the reason the ladder is this long.
 */
const f = mk("foundations");
export const foundations: Skill = {
  id: "foundations",
  name: "Foundations",
  branch: "core",
  blurb: "The wrists, midline and overhead position everything else is built on.",
  unlock: { type: "open" },
  steps: [
    f(
      1,
      "wrist-prep",
      "Wrist preparation",
      "Kneeling wrist circles, palm and finger pulses, front and back of the wrist. Two minutes.",
      "Wrists carry your bodyweight in every handstand. They adapt slower than everything else, so they start first.",
      {
        kind: "quality",
        checklist: [
          "No sharp pain at any point",
          "Full range front and back",
          "Both directions, unhurried",
        ],
      },
    ),
    f(
      2,
      "hollow-hold",
      "Hollow body hold",
      "Lower back flat to the floor, ribs down, legs and shoulders lifted. Hold without the back arching.",
      "The handstand line is a hollow body turned upside down. Every wobble you cannot fix overhead starts as a midline you cannot hold on the floor.",
      { kind: "hold", seconds: 45 },
    ),
    f(
      3,
      "pike-push-up",
      "Pike push-up",
      "Hips high, head between the hands, elbows tracking forward. Lower until the crown touches, press away.",
      "Builds the overhead pressing strength that stops the elbows folding when balance goes wrong.",
      { kind: "reps", reps: 8, sets: 3 },
    ),
  ],
};

const h = mk("handstand");
export const handstand: Skill = {
  id: "handstand",
  name: "Handstand",
  branch: "balance",
  blurb: "Wall line first, then balance. The wall is where the shape is built.",
  // Straight-arm overhead strength AND a midline that holds. Either alone produces a banana.
  unlock: {
    type: "all_of",
    requires: [
      { stepId: "foundations/hollow-hold" },
      { stepId: "foundations/pike-push-up" },
      { stepId: "foundations/wrist-prep", at: "achieved" },
    ],
  },
  steps: [
    h(
      1,
      "wall-plank",
      "Feet-elevated wall plank",
      "Feet on the wall, hands walked in until shoulders stack over wrists. Push the floor away, ribs down.",
      "Teaches the stacked, pushing shoulder position without asking you to balance at the same time.",
      { kind: "hold", seconds: 45 },
    ),
    h(
      2,
      "chest-to-wall-60",
      "Chest-to-wall handstand",
      "Walk up facing the wall, hips stacked, ribs closed, pushing tall through the shoulders. Nose near the wall.",
      "The whole handstand line, held long enough to become the default shape rather than a position you visit.",
      { kind: "hold", seconds: 60 },
    ),
    h(
      3,
      "heel-pulls",
      "Heel pulls",
      "From chest-to-wall, pull one heel off, then the other, staying stacked. Return under control.",
      "First taste of carrying your own weight. Control coming back matters more than time away from the wall.",
      {
        kind: "quality",
        checklist: [
          "Both heels leave the wall",
          "Ribs stay closed",
          "Returns under control, no falling back",
        ],
      },
    ),
    h(
      4,
      "toe-pulls",
      "Toe pulls",
      "Pull both toes off the wall and hold the balance for three seconds before returning.",
      "This is the balance point. Finding it against the wall is how you learn it without a bail.",
      { kind: "hold", seconds: 3, sets: 5 },
    ),
    h(
      5,
      "kick-up",
      "Kick up to balance",
      "Kick up in the open, catch the balance, bail out to the side when it goes. Five controlled attempts.",
      "A reliable entry, and a bail you trust. Without the bail, fear keeps the kick short forever.",
      {
        kind: "quality",
        checklist: [
          "Kicks to vertical, not past it",
          "Bails to the side deliberately",
          "No landing on the back",
        ],
      },
    ),
    h(
      6,
      "freestanding-10",
      "Freestanding handstand, 10s",
      "Kick up and hold. Correct with the fingers, not the hips.",
      "The first real handstand. Correcting through the fingers is what makes it repeatable.",
      { kind: "hold", seconds: 10 },
    ),
    h(
      7,
      "freestanding-30",
      "Freestanding handstand, 30s",
      "Same shape, held. Breathe.",
      "At thirty seconds the handstand stops being an effort and becomes a position you can work from.",
      { kind: "hold", seconds: 30 },
    ),
    h(
      8,
      "walk-10m",
      "Handstand walk, 10m",
      "Shift the weight to the fingers, travel in a straight line.",
      "Proof the balance is yours and not the wall's.",
      { kind: "distance", metres: 10 },
    ),
  ],
};
