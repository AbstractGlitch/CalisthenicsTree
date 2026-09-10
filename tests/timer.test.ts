import { describe, expect, it } from "vitest";
import {
  IDLE, elapsedMs, elapsedSeconds, formatDuration, isRunning,
  remainingMs, reset, start, stop,
} from "../src/engine/timer.js";

describe("timer", () => {
  it("reads elapsed time from the wall clock, not from tick counts", () => {
    // The whole point: a backgrounded phone stops firing intervals, but the elapsed
    // value must still be right when the tab wakes up.
    const t = start(IDLE, 1_000);
    expect(elapsedMs(t, 1_000)).toBe(0);
    expect(elapsedMs(t, 48_000)).toBe(47_000);
    expect(elapsedSeconds(t, 48_000)).toBe(47);
  });

  it("accumulates across pause and resume", () => {
    let t = start(IDLE, 0);
    t = stop(t, 10_000);
    expect(isRunning(t)).toBe(false);
    expect(elapsedMs(t, 999_999)).toBe(10_000); // stopped time does not advance
    t = start(t, 20_000);
    expect(elapsedMs(t, 25_000)).toBe(15_000);
  });

  it("ignores a redundant start or stop", () => {
    const running = start(IDLE, 0);
    expect(start(running, 5_000)).toBe(running);
    const stopped = stop(running, 1_000);
    expect(stop(stopped, 9_000)).toBe(stopped);
  });

  it("never reports negative time when the device clock jumps backwards", () => {
    const t = start(IDLE, 10_000);
    expect(elapsedMs(t, 4_000)).toBe(0);
  });

  it("resets to zero", () => {
    expect(elapsedMs(reset(), 10_000)).toBe(0);
  });
});

describe("formatDuration", () => {
  it("formats as a coach would read it", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(7_000)).toBe("0:07");
    expect(formatDuration(47_400)).toBe("0:47"); // whole seconds, no tenths
    expect(formatDuration(63_000)).toBe("1:03");
    expect(formatDuration(3_800_000)).toBe("1:03:20");
  });
  it("clamps negatives", () => {
    expect(formatDuration(-5_000)).toBe("0:00");
  });
});

describe("remainingMs", () => {
  it("counts down and stops at zero", () => {
    const t = start(IDLE, 0);
    expect(remainingMs(t, 30_000, 90_000)).toBe(60_000);
    expect(remainingMs(t, 200_000, 90_000)).toBe(0);
  });
});
