/**
 * The shipped tree.
 *
 * `contentVersion` is stamped onto every logged set. It never changes what a log means --
 * step IDs do that, and they are permanent -- but it makes it possible to tell later which
 * authored standard someone was training against.
 */

import type { TreeContent } from "./schema.js";
import { foundations, handstand } from "./skills/handstand.js";
import { muscleUp, pull } from "./skills/pull.js";
import { push } from "./skills/push.js";

export const CONTENT: TreeContent = Object.freeze({
  contentVersion: "2026.09.10",
  skills: Object.freeze([foundations, handstand, push, pull, muscleUp]),
});
