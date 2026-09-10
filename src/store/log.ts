/**
 * The append-only set log.
 *
 * There is no update and no delete. A correction is a tombstone plus a new row, which is
 * what makes the log replayable, makes history honest, and makes a future sync a set union
 * keyed by id rather than a conflict-resolution problem.
 */

import type { StepId } from "../content/schema.js";
import type { LoggedSet, ManualOverride, SetValue, UserSettings } from "../engine/types.js";
import { STORE_META, STORE_SETS, get, getAll, put, putAll } from "./db.js";

const SETTINGS_KEY = "settings";
const OVERRIDES_KEY = "overrides";
const SCHEMA_VERSION = 1;

const uuid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** The calendar date in the device's timezone, "YYYY-MM-DD". Stored, never recomputed. */
export function localDateOf(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export async function loadSettings(): Promise<UserSettings> {
  const row = await get<{ key: string; value: UserSettings }>(STORE_META, SETTINGS_KEY);
  if (row?.value) return row.value;
  const fresh: UserSettings = {
    schemaVersion: SCHEMA_VERSION,
    deviceId: uuid(),
    createdAt: new Date().toISOString(),
  };
  await put(STORE_META, { key: SETTINGS_KEY, value: fresh });
  return fresh;
}

export function saveSettings(value: UserSettings): Promise<unknown> {
  return put(STORE_META, { key: SETTINGS_KEY, value });
}

export async function listSets(): Promise<LoggedSet[]> {
  return getAll<LoggedSet>(STORE_SETS);
}

export async function listOverrides(): Promise<ManualOverride[]> {
  const row = await get<{ key: string; value: ManualOverride[] }>(STORE_META, OVERRIDES_KEY);
  return row?.value ?? [];
}

/** Append a set. `sessionId` groups sets logged in one sitting; the caller keeps it. */
export async function appendSet(
  stepId: StepId,
  value: SetValue,
  sessionId: string,
  contentVersion: string,
  extra: { rpe?: number; note?: string } = {},
): Promise<LoggedSet> {
  const settings = await loadSettings();
  const now = new Date();
  const row: LoggedSet = {
    id: uuid(),
    stepId,
    sessionId,
    performedAt: now.toISOString(),
    localDate: localDateOf(now),
    value,
    contentVersion,
    deviceId: settings.deviceId,
    ...(extra.rpe !== undefined ? { rpe: extra.rpe } : {}),
    ...(extra.note !== undefined ? { note: extra.note } : {}),
  };
  await put(STORE_SETS, row);
  return row;
}

/** Retract a set. Writes a tombstone; the row itself is never removed. */
export async function tombstoneSet(id: string): Promise<void> {
  const existing = await get<LoggedSet>(STORE_SETS, id);
  if (!existing || existing.deletedAt) return;
  await put(STORE_SETS, { ...existing, deletedAt: new Date().toISOString() });
}

export async function grantOverride(stepId: StepId, reason: string): Promise<void> {
  const settings = await loadSettings();
  const rows = await listOverrides();
  rows.push({
    id: uuid(),
    stepId,
    grantedAt: new Date().toISOString(),
    reason,
    deviceId: settings.deviceId,
  });
  await put(STORE_META, { key: OVERRIDES_KEY, value: rows });
}

/** Revoke by appending a revoked row, so the grant and its reversal both stay on record. */
export async function revokeOverride(stepId: StepId, reason: string): Promise<void> {
  const settings = await loadSettings();
  const rows = await listOverrides();
  rows.push({
    id: uuid(),
    stepId,
    grantedAt: new Date().toISOString(),
    revokedAt: new Date().toISOString(),
    revocationReason: reason,
    reason,
    deviceId: settings.deviceId,
  });
  await put(STORE_META, { key: OVERRIDES_KEY, value: rows });
}

export const newSessionId = uuid;
export { putAll, STORE_SETS };
