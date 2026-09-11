import { byLabel, fetchCatalogue, type CatalogueGroup } from "./catalogue";
import { qs } from "@shared/dom";
import { CenterPanel, stageWidth } from "./centerPanel";
import { collapsiblePanel } from "./collapsiblePanel";
import { LeftPanel } from "./leftPanel";
import { RightPanel } from "./rightPanel";
import { Scene } from "./scene";

/** The group the page opens on. */
const DEFAULT_LABEL = "12.1";

const catalogue = await fetchCatalogue();
const groups = byLabel(catalogue);
const groupFor = (label: string): CatalogueGroup => groups.get(label) ?? catalogue.groups[0];

collapsiblePanel(qs("#panel-left"), "generatorVisualizer.leftPanelCollapsed");
collapsiblePanel(qs("#panel-right"), "generatorVisualizer.rightPanelCollapsed");

const leftPanel = new LeftPanel(catalogue.groups, selectGroup);
const centerPanel = new CenterPanel({
  onToggleClass: (classIndex) => {
    scene.toggleClass(classIndex);
    render();
  },
  onPickPoint: (point) => {
    scene.pickPoint(point);
    render();
  },
  onSelectRepresentation: selectRepresentation,
});
const rightPanel = new RightPanel((key) => {
  scene.toggleElement(key);
  render();
});

let scene = sceneFor(groupFor(DEFAULT_LABEL));

/**
 * The two panels that show the selection. The left one is not among them: its
 * 526 rows change only when the group does.
 */
function render(): void {
  centerPanel.show(scene);
  rightPanel.show(scene);
}

/** A scene on a group's first representation, opened so the diagram is never bare. */
function sceneFor(group: CatalogueGroup): Scene {
  const next = new Scene(group, group.representations[0], stageWidth());
  next.open(null);
  return next;
}

function selectGroup(label: string): void {
  scene = sceneFor(groupFor(label));
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
