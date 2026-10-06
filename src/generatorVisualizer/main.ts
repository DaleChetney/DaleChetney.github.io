import { byLabel, fetchCatalogue, type CatalogueGroup } from "./catalogue";
import { qs } from "@shared/dom";
import { CenterPanel, diagramPointAt, NARROW_SCREEN, stage } from "./centerPanel";
import type { PlacedRing } from "./components/diagram/permutationDiagram";
import { NodeDrag } from "./components/diagram/nodeDrag";
import { RingDrag } from "./components/diagram/ringDrag";
import { collapsiblePanel } from "./collapsiblePanel";
import { loadLastView, saveLastView, type LastView } from "./lastView";
import { LeftPanel } from "./leftPanel";
import { RightPanel } from "./rightPanel";
import { Rotation } from "./rotation";
import { Scene } from "./scene";
import { applyTheme, loadSettings, saveSettings } from "./settings";
import { settingsPanel } from "./settingsPanel";
import { tabs } from "./tabs";

/**
 * What the page opens on the first time: C_3:C_4 on twelve points, its class
 * of C_4s open with two generators drawn, from different conjugates.
 */
const FIRST_VIEW: LastView = {
  group: "12.1",
  representation: "12T5",
  selection: [[3, ["8,1,6,11,4,9,2,7,12,5,10,3", "12,5,10,3,8,1,6,11,4,9,2,7"]]],
};

const catalogue = await fetchCatalogue();
const groups = byLabel(catalogue);
const groupFor = (label: string): CatalogueGroup => groups.get(label) ?? catalogue.groups[0];

// A phone has no room beside the diagram, so the side panels start folded away there.
const narrow = window.matchMedia(NARROW_SCREEN).matches;
collapsiblePanel(qs("#panel-left"), "generatorVisualizer.leftPanelCollapsed", narrow);
collapsiblePanel(qs("#panel-right"), "generatorVisualizer.rightPanelCollapsed", narrow);
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
  onToggleLock: (orbit) => {
    scene.toggleLock(orbit);
    render();
  },
  onToggleCenter: (orbit) => {
    scene.toggleCenter(orbit);
    render();
  },
  // A node of an unlocked orbit is dragged on its own; any other turns its ring.
  onDragStart: (point, clientX, clientY) => {
    const at = diagramPointAt(clientX, clientY);
    const orbit = scene.ringOf(point)?.orbit;
    if (at === null || orbit === undefined) return;
    if (!scene.isLocked(orbit)) {
      const node = scene.pointAt(point);
      if (node !== undefined) drag = { point, tracker: new NodeDrag(node, at) };
      return;
    }
    const ring = scene.grabRing(point);
    if (ring !== undefined) drag = { ring, tracker: new RingDrag({ x: ring.cx, y: ring.cy }, at) };
  },
  // A drag moves the diagram already drawn, like a frame of play: a redraw would
  // replace the node that has the pointer captured and end the drag.
  onDragMove: (clientX, clientY) => {
    const at = diagramPointAt(clientX, clientY);
    if (drag === null || at === null) return;
    if ("point" in drag) scene.movePoint(drag.point, drag.tracker.moveTo(at));
    else scene.turnRing(drag.ring.orbit, drag.ring.ring, drag.tracker.moveTo(at));
    centerPanel.turn(scene, settings);
  },
  onDragEnd: () => {
    drag = null;
    scene.letGoRing();
  },
});
/** The drag in progress and the ring or node it has hold of; null while there is none. */
let drag: { ring: PlacedRing; tracker: RingDrag } | { point: number; tracker: NodeDrag } | null =
  null;
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

let scene = startingScene();

/**
 * The two panels that show the selection. The left one is not among them: its
 * 402 rows change only when the group does. The clock runs only while some
 * orbit of the scene is turning, and every change of scene passes through here,
 * so here is where it is remembered for next time.
 */
function render(): void {
  saveLastView({
    group: scene.group.label,
    representation: scene.representation.id,
    selection: scene.storedSelection(),
  });
  if (scene.turning) rotation.play();
  else rotation.pause();
  centerPanel.show(scene, settings);
  rightPanel.show(scene);
}

/** A scene on a group's first representation, opened so the diagram is never bare. */
function sceneFor(group: CatalogueGroup): Scene {
  const next = new Scene(group, group.representations[0], stage(), catalogue.cyclicAutExponents);
  next.open(null);
  return next;
}

/** The scene last looked at, or on a first visit, or if the catalogue has lost it, the first one. */
function startingScene(): Scene {
  const last = loadLastView();
  return (
    (last === null ? null : sceneOf(last)) ?? sceneOf(FIRST_VIEW) ?? sceneFor(catalogue.groups[0])
  );
}

/**
 * The scene a stored view describes, or null for a group the catalogue no
 * longer has. A representation it no longer has opens the group afresh, since
 * the selection was written in that one.
 */
function sceneOf(view: LastView): Scene | null {
  const group = groups.get(view.group);
  if (group === undefined) return null;
  const representation = group.representations.find((rep) => rep.id === view.representation);
  if (representation === undefined) return sceneFor(group);
  const next = new Scene(group, representation, stage(), catalogue.cyclicAutExponents);
  next.open(view.selection === null ? null : next.selectionFrom(view.selection));
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
  const next = new Scene(scene.group, representation, stage(), catalogue.cyclicAutExponents);
  next.open(scene.carrySelectionTo(next));
  scene = next;
  render();
}

// The diagram is laid out to a measured width, so a resized window wants a new
// layout rather than a scaled one — the nodes should keep their size.
window.addEventListener("resize", () => {
  scene.relayout(stage());
  render();
});

render();
leftPanel.show(scene.group.label);
