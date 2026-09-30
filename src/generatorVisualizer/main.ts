import { byLabel, fetchCatalogue, type CatalogueGroup } from "./catalogue";
import { qs } from "@shared/dom";
import { CenterPanel, stageWidth } from "./centerPanel";
import { collapsiblePanel } from "./collapsiblePanel";
import { LeftPanel } from "./leftPanel";
import { RightPanel } from "./rightPanel";
import { Rotation } from "./rotation";
import { Scene } from "./scene";
import { applyTheme, loadSettings, saveSettings } from "./settings";
import { settingsPanel } from "./settingsPanel";
import { tabs } from "./tabs";

/** The group the page opens on. */
const DEFAULT_LABEL = "12.1";

const catalogue = await fetchCatalogue();
const groups = byLabel(catalogue);
const groupFor = (label: string): CatalogueGroup => groups.get(label) ?? catalogue.groups[0];

collapsiblePanel(qs("#panel-left"), "generatorVisualizer.leftPanelCollapsed");
collapsiblePanel(qs("#panel-right"), "generatorVisualizer.rightPanelCollapsed");
tabs(qs("#panel-right"), "generatorVisualizer.rightPanelTab");

let settings = loadSettings();
applyTheme(settings.theme);
settingsPanel(qs("#settings"), settings, (changed) => {
  settings = changed;
  saveSettings(settings);
  applyTheme(settings.theme);
  render();
});

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
  onStepRings: (orbit, step) => {
    scene.stepRings(orbit, step);
    render();
  },
  onTogglePlay: (orbit) => {
    scene.togglePlay(orbit);
    render();
  },
});
// Each frame turns the orbits that are playing, and moves the diagram already
// drawn rather than drawing it again.
const rotation = new Rotation((seconds) => {
  scene.turnBy(seconds / settings.rotationPeriod);
  centerPanel.turn(scene, settings);
});
const rightPanel = new RightPanel((key) => {
  scene.toggleElement(key);
  render();
});

let scene = sceneFor(groupFor(DEFAULT_LABEL));

/**
 * The two panels that show the selection. The left one is not among them: its
 * 402 rows change only when the group does. The clock runs only while some
 * orbit of the scene is turning, and every change of scene passes through here.
 */
function render(): void {
  if (scene.turning) rotation.play();
  else rotation.pause();
  centerPanel.show(scene, settings);
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
