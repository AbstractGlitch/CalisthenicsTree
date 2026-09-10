/**
 * The store's contract, which the sync story depends on:
 * rows are immutable, deletes are tombstones, and a merge is idempotent.
 */
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { BackupFormatError, exportBackup, importBackup } from "../src/store/backup.js";
import {
  appendSet,
  grantOverride,
  listOverrides,
  listSets,
  loadSettings,
  localDateOf,
  newSessionId,
  revokeOverride,
  tombstoneSet,
} from "../src/store/log.js";

describe("localDateOf", () => {
  it("formats the device's calendar date", () => {
    expect(localDateOf(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});

describe("the log", () => {
  let session: string;
  beforeEach(() => {
    session = newSessionId();
  });

  it("stamps a set with device, date and content version", async () => {
    const settings = await loadSettings();
    const row = await appendSet("a/b", { kind: "hold", seconds: 30 }, session, "v1", { rpe: 8 });
    expect(row.deviceId).toBe(settings.deviceId);
    expect(row.localDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(row.contentVersion).toBe("v1");
    expect(row.rpe).toBe(8);
  });

  it("keeps a stable device id across loads", async () => {
    expect((await loadSettings()).deviceId).toBe((await loadSettings()).deviceId);
  });

  it("tombstones rather than deletes", async () => {
    const row = await appendSet("a/b", { kind: "reps", reps: 5 }, session, "v1");
    const before = (await listSets()).length;
    await tombstoneSet(row.id);
    const after = await listSets();
    expect(after).toHaveLength(before);
    expect(after.find((s) => s.id === row.id)?.deletedAt).toBeTruthy();
  });

  it("ignores a repeated tombstone", async () => {
    const row = await appendSet("a/b", { kind: "reps", reps: 5 }, session, "v1");
    await tombstoneSet(row.id);
    const first = (await listSets()).find((s) => s.id === row.id)?.deletedAt;
    await tombstoneSet(row.id);
    expect((await listSets()).find((s) => s.id === row.id)?.deletedAt).toBe(first);
  });

  it("records a grant and its revocation as two rows", async () => {
    await grantOverride("a/b", "could already do it");
    await revokeOverride("a/b", "granted by mistake");
    const rows = await listOverrides();
    expect(rows.filter((o) => o.stepId === "a/b")).toHaveLength(2);
    expect(rows.at(-1)?.revocationReason).toBe("granted by mistake");
  });
});

describe("backup", () => {
  it("round-trips, and re-importing changes nothing", async () => {
    await appendSet("a/b", { kind: "hold", seconds: 12 }, newSessionId(), "v1");
    const dump = await exportBackup("v1");
    expect(dump.format).toBe(1);
    const before = (await listSets()).length;
    await importBackup(JSON.stringify(dump));
    expect(await listSets()).toHaveLength(before);
  });

  it("rejects malformed JSON", async () => {
    await expect(importBackup("{ not json")).rejects.toBeInstanceOf(BackupFormatError);
  });

  it("refuses a backup from a newer format", async () => {
    const dump = await exportBackup("v1");
    await expect(
      importBackup(JSON.stringify({ ...dump, format: 99 })),
    ).rejects.toBeInstanceOf(BackupFormatError);
  });

  it("refuses a file with no sets", async () => {
    await expect(importBackup(JSON.stringify({ format: 1 }))).rejects.toBeInstanceOf(
      BackupFormatError,
    );
  });
});
