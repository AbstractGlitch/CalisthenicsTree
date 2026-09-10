/**
 * App shell.
 *
 * The whole UI is a function of one projection, recomputed from the log on every render.
 * There is no view state to keep in sync with the data, because there is no stored state
 * to disagree with.
 */

import "./views/styles.css";
import { CONTENT } from "./content/tree.js";
import { buildTreeProjection } from "./engine/projection.js";
import type { TreeProjection } from "./engine/types.js";
import { listOverrides, listSets, loadSettings } from "./store/log.js";
import { renderSkill } from "./views/skill.js";
import { renderTree } from "./views/tree.js";

const app = document.querySelector<HTMLDivElement>("#app")!;
let route: { view: "tree" } | { view: "skill"; skillId: string } = { view: "tree" };

async function project(): Promise<TreeProjection> {
  const [sets, overrides, settings] = await Promise.all([
    listSets(),
    listOverrides(),
    loadSettings(),
  ]);
  return buildTreeProjection(CONTENT, sets, overrides, new Date(), settings);
}

async function render(): Promise<void> {
  const projection = await project();
  if (route.view === "skill") {
    const s = projection.skills.find((x) => x.skill.id === (route as { skillId: string }).skillId);
    if (s) {
      app.innerHTML = renderSkill(s.skill, s);
      return;
    }
    route = { view: "tree" };
  }
  app.innerHTML = renderTree(CONTENT, projection);
}

app.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  const node = target.closest<HTMLElement>("[data-skill]");
  if (node?.dataset.skill) {
    route = { view: "skill", skillId: node.dataset.skill };
    void render();
    return;
  }
  if (target.closest("[data-back]")) {
    route = { view: "tree" };
    void render();
  }
});

void render();
