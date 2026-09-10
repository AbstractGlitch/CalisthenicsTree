/**
 * Export and import.
 *
 * With no server this is the only backup that exists, so it is a first-class feature, not a
 * settings-screen afterthought. magnetic-practice takes the same line: a JSON dump the user
 * owns, and a reset that tells them to take one first.
 */

import type { LoggedSet, ManualOverride, UserSettings } from "../engine/types.js";
import { STORE_META, STORE_SETS, putAll } from "./db.js";
import { listOverrides, listSets, loadSettings, saveSettings } from "./log.js";

export const BACKUP_FORMAT = 1;

export interface Backup {
  format: number;
  exportedAt: string;
  contentVersion: string;
  settings: UserSettings;
  sets: LoggedSet[];
  overrides: ManualOverride[];
}

export async function exportBackup(contentVersion: string): Promise<Backup> {
  const [settings, sets, overrides] = await Promise.all([
    loadSettings(),
    listSets(),
    listOverrides(),
  ]);
  return {
    format: BACKUP_FORMAT,
    exportedAt: new Date().toISOString(),
    contentVersion,
    settings,
    sets,
    overrides,
  };
}

export class BackupFormatError extends Error {}

function parse(raw: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new BackupFormatError("That file is not valid JSON.");
  }
  const b = data as Partial<Backup>;
  if (typeof b?.format !== "number") throw new BackupFormatError("Missing backup format.");
  if (b.format > BACKUP_FORMAT) {
    throw new BackupFormatError(
      `That backup was written by a newer version (format ${b.format}). Update the app first.`,
    );
  }
  if (!Array.isArray(b.sets)) throw new BackupFormatError("Backup has no sets.");
  return b as Backup;
}

/**
 * Import, merging rather than replacing.
 *
 * Rows are uuid-keyed and immutable, so a merge is a union: importing the same backup twice
 * is a no-op, and importing a second device's backup combines the two histories. This is
 * the same operation a sync server would perform, which is the point -- the merge path is
 * exercised from day one rather than written for the first time alongside a server.
 */
export async function importBackup(raw: string): Promise<{ sets: number; overrides: number }> {
  const backup = parse(raw);
  await putAll(STORE_SETS, backup.sets);
  if (backup.overrides?.length) {
    const existing = await listOverrides();
    const byId = new Map(existing.map((o) => [o.id, o]));
    for (const o of backup.overrides) byId.set(o.id, o);
    await putAll(STORE_META, [{ key: "overrides", value: [...byId.values()] }]);
  }
  // Keep this device's own identity; adopt only tuning the user chose.
  const mine = await loadSettings();
  if (backup.settings?.consolidationOverride) {
    await saveSettings({ ...mine, consolidationOverride: backup.settings.consolidationOverride });
  }
  return { sets: backup.sets.length, overrides: backup.overrides?.length ?? 0 };
}
