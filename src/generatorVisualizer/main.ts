import { equidistantColours } from "@shared/colours";
import { mount, qs } from "@shared/dom";
import { permutationKey } from "@shared/mathUtils/groups/permutations";
import { byLabel, fetchCatalogue, type CatalogueGroup } from "./catalogue";
import { actionArrows } from "./components/diagram/arrow";
import { renderPermutationDiagram } from "./components/diagram/permutationDiagram";
import { DEFAULT_TARGET_WIDTH } from "./components/diagram/ringLayout";
import { renderElementSections, type ElementSection } from "./components/elements-panel";
import { filterGroups, groupListCaption, renderGroupList } from "./components/group-list";
import { classLabel, renderLattice } from "./components/lattice";
import { renderRepresentationRow } from "./components/representation-row";
import { Scene } from "./scene";

/** The group the page opens on. */
const DEFAULT_LABEL = "12.1";

const catalogue = await fetchCatalogue();
const groups = byLabel(catalogue);

const stage = qs("#diagram");
const latticeHost = qs("#lattice");
const panel = qs("#element-sections");
const listHost = qs("#group-list");
const countHost = qs("#group-count");
const representationHost = qs("#representation-row");
const search = qs<HTMLInputElement>("#group-search");

/** The panel is measured rather than assumed, so the diagram spreads to the window it is in. */
const panelWidth = (): number => stage.clientWidth || DEFAULT_TARGET_WIDTH;

const groupFor = (label: string): CatalogueGroup => groups.get(label) ?? catalogue.groups[0];

const openingGroup = groupFor(DEFAULT_LABEL);
let scene = new Scene(openingGroup, openingGroup.representations[0], panelWidth());
/** Chosen element keys, per selected class. A class with an empty set stays open. */
let selection = new Map<number, Set<string>>();
let colours = new Map<string, string>();
let query = "";

const chosenKeys = (): string[] => [...selection.values()].flatMap((keys) => [...keys]);

/**
 * A colour per drawn element, spread evenly over however many are drawn rather
 * than taken from a fixed list, so they stay as far apart as the count allows.
 */
const spreadColours = (): Map<string, string> => {
  const keys = chosenKeys().sort((a, b) => scene.rankOf(a) - scene.rankOf(b));
  const scale = equidistantColours(keys.length);
  return new Map(keys.map((key, index) => [key, scale[index]]));
};

const colourOf = (key: string): string | null => colours.get(key) ?? null;

/** Colour of the first element chosen from a class, in the class's own order. */
const nodeColour = (classIndex: number): string | null => {
  const keys = selection.get(classIndex);
  if (keys === undefined || keys.size === 0) return null;
  const first = scene
    .choicesFor(classIndex)
    .elements.map((choice) => permutationKey(choice.permutation))
    .find((key) => keys.has(key));
  return first === undefined ? null : colourOf(first);
};

const sections = (): ElementSection[] =>
  scene.selectableClasses
    .filter((classIndex) => selection.has(classIndex))
    .map((classIndex) => ({
      classIndex,
      label: classLabel(scene.classAt(classIndex), scene.group.order, scene.group.displayName),
      conjugateCount: scene.classAt(classIndex).count,
      choices: scene.choicesFor(classIndex),
    }));

/**
 * Redrawing replaces every node, which would drop focus after each toggle and
 * make the controls unusable from the keyboard. Remember what had focus by a
 * selector that survives the rebuild, and restore it afterwards.
 */
const focusedSelector = (): string | null => {
  const active = document.activeElement;
  if (!(active instanceof Element)) return null;
  const element = active.closest("[data-element]")?.getAttribute("data-element");
  if (element != null) return `[data-element="${element}"] input`;
  const row = active.closest(".group-row[data-label]")?.getAttribute("data-label");
  if (row != null) return `.group-row[data-label="${row}"]`;
  const node = active.closest(".lattice-node[data-class]")?.getAttribute("data-class");
  return node == null ? null : `.lattice-node[data-class="${node}"]`;
};

const restoreFocus = (selector: string | null): void => {
  if (selector === null) return;
  const target = document.querySelector(selector);
  if (target instanceof HTMLElement || target instanceof SVGElement) target.focus();
};

/** The left panel. Kept off the toggle path: 526 rows is a lot to rebuild. */
const drawGroups = (): void => {
  const focused = focusedSelector();
  const matches = filterGroups(catalogue.groups, query);
  countHost.textContent = groupListCaption(matches.length, catalogue.groups.length);
  mount(listHost, renderGroupList(matches, { selected: scene.group.label, onSelect: selectGroup }));
  restoreFocus(focused);
};

const draw = (): void => {
  const focused = focusedSelector();
  colours = spreadColours();
  const drawn = new Set([...colours.keys()].map((key) => scene.rankOf(key)));
  mount(
    stage,
    renderPermutationDiagram(
      scene.diagram,
      actionArrows(scene.diagram.points, scene.palette, drawn),
      (generator) => colourOf(permutationKey(scene.palette[generator])) ?? "currentColor",
    ),
  );
  mount(
    latticeHost,
    renderLattice(
      scene.latticeDiagram,
      {
        selected: new Set(selection.keys()),
        completing: scene.completingClasses(selection),
        onToggle: toggleClass,
      },
      nodeColour,
    ),
  );
  mount(
    panel,
    renderElementSections(sections(), {
      isSelected: (key) => colours.has(key),
      colourOf,
      onToggle: toggleElement,
    }),
  );
  mount(
    representationHost,
    renderRepresentationRow(scene.group.representations, {
      selected: scene.representation.id,
      onSelect: selectRepresentation,
    }),
  );
  restoreFocus(focused);
};

const toggleClass = (classIndex: number): void => {
  if (selection.has(classIndex)) {
    selection.delete(classIndex);
  } else {
    const first = scene.choicesFor(classIndex).elements[0];
    selection.set(
      classIndex,
      new Set(first === undefined ? [] : [permutationKey(first.permutation)]),
    );
  }
  draw();
};

const toggleElement = (key: string): void => {
  const classIndex = scene.classOf(key);
  if (classIndex === undefined) return;
  const keys = selection.get(classIndex);
  if (keys === undefined) return;
  if (keys.has(key)) keys.delete(key);
  else keys.add(key);
  draw();
};

/**
 * Show a scene. Without a selection to carry over it opens with one generator
 * already drawn, so the diagram is never bare.
 */
const showScene = (next: Scene, carried: Map<number, Set<string>> | null): void => {
  scene = next;
  qs("#group-name").textContent = scene.group.displayName;
  const label = qs<HTMLAnchorElement>("#group-label");
  label.textContent = scene.group.label;
  label.href = `https://www.lmfdb.org/Groups/Abstract/${scene.group.label}`;

  if (carried !== null) {
    selection = carried;
    draw();
    return;
  }
  selection = new Map();
  const last = scene.selectableClasses[scene.selectableClasses.length - 1];
  if (last !== undefined) toggleClass(last);
  else draw();
};

function selectGroup(label: string): void {
  const group = groupFor(label);
  showScene(new Scene(group, group.representations[0], panelWidth()), null);
  drawGroups();
}

function selectRepresentation(id: string): void {
  const representation =
    scene.group.representations.find((rep) => rep.id === id) ?? scene.group.representations[0];
  if (representation.id === scene.representation.id) return;
  const next = new Scene(scene.group, representation, panelWidth());
  showScene(next, scene.carrySelectionTo(next, selection));
}

search.addEventListener("input", () => {
  query = search.value;
  drawGroups();
});

// The diagram is laid out to a measured width, so a resized window wants a new
// layout rather than a scaled one — the nodes should keep their size.
window.addEventListener("resize", () => {
  scene.relayout(panelWidth());
  draw();
});

showScene(scene, null);
drawGroups();
