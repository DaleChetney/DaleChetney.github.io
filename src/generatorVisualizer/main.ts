import { byLabel, fetchCatalogue, type CatalogueGroup } from "./catalogue";
import { LeftPanel } from "./leftPanel";
import { RightPanel } from "./rightPanel";
import { Scene, stageWidth } from "./scene";

/** The group the page opens on. */
const DEFAULT_LABEL = "12.1";

const catalogue = await fetchCatalogue();
const groups = byLabel(catalogue);
const groupFor = (label: string): CatalogueGroup => groups.get(label) ?? catalogue.groups[0];

let scene = openScene(groupFor(DEFAULT_LABEL));

const leftPanel = new LeftPanel(catalogue.groups, selectGroup);
const rightPanel = new RightPanel((key) => {
  scene.toggleElement(key);
});

/**
 * The centre and right panels, which both show the current selection. The left
 * panel is not here: its 526 rows change only when the group does.
 */
function render(): void {
  scene.show(render, selectRepresentation);
  rightPanel.show(scene);
}

/** Build a scene for a group's first representation and open it. */
function openScene(group: CatalogueGroup): Scene {
  const next = new Scene(group, group.representations[0], stageWidth());
  next.open(null);
  return next;
}

function selectGroup(label: string): void {
  scene = openScene(groupFor(label));
  render();
  leftPanel.show(label);
}

/** Switching representation is not a fresh start: the selection is carried across. */
function selectRepresentation(id: string): void {
  const representation =
    scene.group.representations.find((rep) => rep.id === id) ?? scene.group.representations[0];
  if (representation.id === scene.representation.id) return;
  const next = new Scene(scene.group, representation, stageWidth());
  next.open(scene.carrySelectionTo(next));
  scene = next;
  render();
}

// The diagram is laid out to a measured width, so a resized window wants a new
// layout rather than a scaled one — the nodes should keep their size.
window.addEventListener("resize", () => {
  scene.relayout(stageWidth());
  render();
});

render();
leftPanel.show(scene.group.label);
