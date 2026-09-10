# Calisthenics Tree

Track progress through a calisthenics skill tree — handstand, muscle-up, and the
progressions underneath them. A local-first, installable PWA: it works with no signal, keeps
no accounts, and talks to no server.

This is a **scaffold**. The engine and content model are complete and tested; the UI is a
read-only map and ladder that proves the engine works end to end. The logging screen is the
next piece of work.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 77 tests
npm run typecheck
npm run build      # typecheck + production build + service worker
```

## The two ideas the design rests on

**Progress is derived, never stored.** There is no `unlocked` flag and no `completed`
column anywhere. `buildTreeProjection(content, log, overrides, now)` recomputes every state
from an append-only log of sets each time a screen renders. Charts, retroactive rule changes
and honest history all fall out of this for free, and a bug can never leave the tree in a
state the log does not justify.

**A skill hit once is not a skill.** A step is `achieved` the first time you meet its
standard, and `consolidated` only after three qualifying sessions within 21 days.
Prerequisites gate on `consolidated` by default. A tree that opens the next planche
progression on one self-reported rep is both gameable and a way to get hurt; per-edge, a
prerequisite can opt down to `achieved` where a softer gate is the honest one.

Two consequences worth knowing about:

- **Sessions are bucketed by calendar day.** Three qualifying sets in one afternoon are one
  session, not three. `tests/attainment.test.ts` pins this.
- **Staleness never re-locks.** A step untrained for eight weeks shows as `stale`, but still
  satisfies every gate it already satisfied. Re-locking someone's handstand because they
  took a holiday would be punitive.

## Layout

```
src/content/     the authored tree -- schema.ts, tree.ts, skills/
src/engine/      pure functions, no I/O: criterion, attainment, unlock, projection, layout
src/store/       IndexedDB (db.ts), the append-only log (log.ts), export/import (backup.ts)
src/views/       read-only map and ladder
tests/           77 tests, engine + store + content health
```

`src/engine/projection.ts` is the only entry point a view needs.

## Content rules

Step IDs are permanent. Never renumber, never reuse, never delete — set `retired: true`
instead, so historical logs still resolve. `order` is display position only, never identity.

`tests/content.test.ts` fails the build on a prerequisite that points at a nonexistent step,
a duplicate ID, a skill/step ID mismatch, or a cycle. These are invisible in review and
silently lock a branch forever, so they are checked in CI rather than by eye. (It earned its
keep immediately: it caught a copy-pasted ID prefix on the first run.)

## Adding sync later

Nothing needs reshaping to add a server. Every set is uuid-keyed and immutable, deletes are
tombstones, and overrides are grant/revoke rows rather than mutable fields — so a sync is a
**set union keyed by `id`**, with no conflict resolution to write. `importBackup` already
performs exactly that merge, which is why re-importing a backup is a no-op and importing a
second device's history combines the two.

## Two limitations, stated plainly

**No server means no backup.** Lose the phone, lose the log. Export is the only safety net,
which is why it is a first-class feature rather than a settings-screen afterthought.

**iOS evicts script-writable storage after 7 days of non-use.** For a training app with a
deload week, that is data loss rather than an edge case. Home-screen–installed PWAs are
documented as exempt, which makes the install prompt load-bearing. **Verify this on a real
iPhone before anyone relies on it** — if it does not hold, sync stops being optional.

## Not in v1

Accounts, sync, social and leaderboards; video form-check (the `quality` criterion exists,
media storage does not); programme generation; Health/Fit integration; a tree editor; push
notifications.
