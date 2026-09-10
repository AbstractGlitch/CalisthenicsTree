/**
 * Stopwatch arithmetic, kept out of the view so it can be tested.
 *
 * The timer is a pair of wall-clock timestamps, never a tick count. A phone that
 * backgrounds the tab throttles setInterval to once a second or stops it entirely, so a
 * counted timer under-reports a hold -- and under-reporting is the failure mode that
 * quietly denies someone a step they actually earned. Ticks drive repainting only; the
 * number shown is always `now - startedAt`.
 */

export interface TimerState {
  /** Wall-clock ms when the current run began, or undefined when stopped. */
  startedAt?: number;
  /** Completed ms from previous runs, for a timer that was paused and resumed. */
  accumulatedMs: number;
}

export const IDLE: TimerState = { accumulatedMs: 0 };

export function start(state: TimerState, now: number): TimerState {
  if (state.startedAt !== undefined) return state; // already running
  return { startedAt: now, accumulatedMs: state.accumulatedMs };
}

export function stop(state: TimerState, now: number): TimerState {
  if (state.startedAt === undefined) return state;
  return { accumulatedMs: elapsedMs(state, now) };
}

export function reset(): TimerState {
  return { accumulatedMs: 0 };
}

export function isRunning(state: TimerState): boolean {
  return state.startedAt !== undefined;
}

/**
 * Elapsed milliseconds.
 *
 * Clamped at zero: a device clock that jumps backwards (NTP correction, manual change)
 * would otherwise produce a negative hold, which is worse than a short one.
 */
export function elapsedMs(state: TimerState, now: number): number {
  const running = state.startedAt === undefined ? 0 : now - state.startedAt;
  return Math.max(0, state.accumulatedMs + Math.max(0, running));
}

export function elapsedSeconds(state: TimerState, now: number): number {
  return elapsedMs(state, now) / 1000;
}

/** "0:47" / "1:03:20". Whole seconds -- a hold is not measured in tenths. */
export function formatDuration(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Remaining ms on a countdown, for the rest timer. Never negative. */
export function remainingMs(state: TimerState, now: number, targetMs: number): number {
  return Math.max(0, targetMs - elapsedMs(state, now));
}
