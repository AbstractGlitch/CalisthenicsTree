import type { LoggedSet, SetValue } from "../src/engine/types.js";

let n = 0;
export const uid = () => `id-${++n}`;

/** Build a set. `date` is the localDate; performedAt is derived from it at midday. */
export function set(
  stepId: string,
  date: string,
  value: SetValue,
  overrides: Partial<LoggedSet> = {},
): LoggedSet {
  return {
    id: uid(),
    stepId,
    sessionId: `session-${date}`,
    performedAt: `${date}T12:00:00.000Z`,
    localDate: date,
    value,
    contentVersion: "test",
    deviceId: "device-1",
    ...overrides,
  };
}

export const hold = (seconds: number): SetValue => ({ kind: "hold", seconds });
export const reps = (r: number): SetValue => ({ kind: "reps", reps: r });
export const eachSide = (left: number, right: number): SetValue => ({
  kind: "reps_each_side",
  left,
  right,
});

/** N sets of the same value on one date -- one session. */
export function session(stepId: string, date: string, value: SetValue, count = 1): LoggedSet[] {
  return Array.from({ length: count }, () => set(stepId, date, value));
}
