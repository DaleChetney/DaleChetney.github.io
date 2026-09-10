import { equidistantColours } from "@shared/colours";
import { findIsomorphism, type GroupIsomorphism } from "@shared/mathUtils/groups/isomorphism";
import { mount, qs } from "@shared/dom";
import { permutationOrbits, type Permutation } from "@shared/mathUtils/groups/permutations";
import {
  computeSubgroupLattice,
  generatesWholeGroup,
  generatorElements,
  type GeneratorChoices,
  type SubgroupClass,
  type SubgroupLattice,
} from "@shared/mathUtils/groups/subgroups";
import {
  byLabel,
  fetchCatalogue,
  type CatalogueGroup,
  type CatalogueRepresentation,
} from "./catalogue";
import {
  elementKey,
  renderElementSections,
  type ElementSection,
} from "./components/elements-panel";
import { filterGroups, groupListCaption, renderGroupList } from "./components/group-list";
import {
  actionArrows,
  diagramWidthShare,
  DEFAULT_TARGET_WIDTH,
  layoutOrbits,
  type Diagram,
} from "./layout";
import {
  classLabel,
  layoutLattice,
  renderLattice,
  type LatticeDiagram,
} from "./components/lattice";
import { renderDiagram } from "./render";
import { renderRepresentationRow } from "./components/representation-row";

/** How many generators a subgroup section will offer. */
const ELEMENT_LIMIT = 12;

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

/**
 * Lay the rings out to the share of the panel this many of them have earned.
 * The panel is measured rather than assumed, so the diagram spreads to the
 * window it is actually in.
 */
const layoutDiagram = (orbits: readonly (readonly number[])[]): Diagram =>
  layoutOrbits(
    orbits,
    (stage.clientWidth || DEFAULT_TARGET_WIDTH) * diagramWidthShare(orbits.length),
  );

/** Everything derived from one group in one representation. */
interface Scene {
  group: CatalogueGroup;
  representation: CatalogueRepresentation;
  /** Kept so the diagram can be laid out again when the window changes size. */
  orbits: number[][];
  diagram: Diagram;
  lattice: SubgroupLattice;
  latticeDiagram: LatticeDiagram;
  /**
   * Classes a generator can be chosen from: a cyclic subgroup is exactly one
   * with elements lying in no smaller subgroup, and the trivial one offers
   * nothing.
   */
  selectableClasses: number[];
  choices: Map<number, GeneratorChoices>;
  /**
   * Every choosable element, in a fixed order. A permutation generates exactly
   * one cyclic subgroup, so each appears once, and its position here orders the
   * selection for colouring — keeping that independent of click order.
   */
  palette: Permutation[];
  paletteIndex: Map<string, number>;
  permutationFor: Map<string, Permutation>;
  classOfElement: Map<string, number>;
}

const buildScene = (group: CatalogueGroup, representation: CatalogueRepresentation): Scene => {
  const { generators, degree } = representation;
  const lattice = computeSubgroupLattice(generators, degree);
  const selectableClasses = lattice.classes
    .map((subgroupClass, index) => ({ subgroupClass, index }))
    .filter(({ subgroupClass }) => subgroupClass.cyclic && subgroupClass.order > 1)
    .map(({ index }) => index);
  const choices = new Map(
    selectableClasses.map((index) => [
      index,
      generatorElements(lattice.classes[index], ELEMENT_LIMIT),
    ]),
  );
  const palette = selectableClasses.flatMap(
    (index) => choices.get(index)?.elements.map((choice) => choice.permutation) ?? [],
  );

  const orbits = permutationOrbits(generators, degree);

  return {
    group,
    representation,
    orbits,
    diagram: layoutDiagram(orbits),
    lattice,
    latticeDiagram: layoutLattice(lattice, group.order, group.displayName),
    selectableClasses,
    choices,
    palette,
    paletteIndex: new Map(palette.map((permutation, i) => [elementKey(permutation), i])),
    permutationFor: new Map(palette.map((p) => [elementKey(p), p])),
    classOfElement: new Map(
      selectableClasses.flatMap((index) =>
        (choices.get(index)?.elements ?? []).map((choice): [string, number] => [
          elementKey(choice.permutation),
          index,
        ]),
      ),
    ),
  };
};

const groupFor = (label: string): CatalogueGroup => {
  const group = groups.get(label) ?? catalogue.groups[0];
  return group;
};

let scene = buildScene(groupFor(DEFAULT_LABEL), groupFor(DEFAULT_LABEL).representations[0]);
/** Chosen element keys, per selected class. A class with an empty set stays open. */
let selection = new Map<number, Set<string>>();
let colours = new Map<string, string>();
let query = "";

const choicesFor = (classIndex: number): GeneratorChoices =>
  scene.choices.get(classIndex) ?? { elements: [], total: 0 };

const chosenKeys = (): string[] => [...selection.values()].flatMap((keys) => [...keys]);
const chosenPermutations = (): Permutation[] =>
  chosenKeys().map((key) => scene.permutationFor.get(key) ?? []);

/**
 * A colour per drawn element, spread evenly over however many are drawn rather
 * than taken from a fixed list, so they stay as far apart as the count allows.
 */
const spreadColours = (): Map<string, string> => {
  const keys = chosenKeys().sort(
    (a, b) => (scene.paletteIndex.get(a) ?? 0) - (scene.paletteIndex.get(b) ?? 0),
  );
  const scale = equidistantColours(keys.length);
  return new Map(keys.map((key, index) => [key, scale[index]]));
};

const colourOf = (key: string): string | null => colours.get(key) ?? null;

/**
 * Classes offering an element that would complete the current choice into a
 * generating set. Existential over the class's elements rather than just its
 * first: which conjugate an element generates decides what it adds.
 */
const completingClasses = (): Set<number> => {
  const chosen = chosenPermutations();
  const completing = new Set<number>();
  const { degree } = scene.representation;
  if (generatesWholeGroup(chosen, degree, scene.group.order)) return completing;
  for (const classIndex of scene.selectableClasses) {
    if (selection.has(classIndex)) continue;
    const completes = choicesFor(classIndex).elements.some((choice) =>
      generatesWholeGroup([...chosen, choice.permutation], degree, scene.group.order),
    );
    if (completes) completing.add(classIndex);
  }
  return completing;
};

/** Colour of the first element chosen from a class, in the class's own order. */
const nodeColour = (classIndex: number): string | null => {
  const keys = selection.get(classIndex);
  if (keys === undefined || keys.size === 0) return null;
  const first = choicesFor(classIndex)
    .elements.map((choice) => elementKey(choice.permutation))
    .find((key) => keys.has(key));
  return first === undefined ? null : colourOf(first);
};

const sections = (): ElementSection[] =>
  scene.selectableClasses
    .filter((classIndex) => selection.has(classIndex))
    .map((classIndex) => ({
      classIndex,
      label: classLabel(
        scene.lattice.classes[classIndex],
        scene.group.order,
        scene.group.displayName,
      ),
      conjugateCount: scene.lattice.classes[classIndex].count,
      choices: choicesFor(classIndex),
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
  const drawn = new Set([...colours.keys()].map((key) => scene.paletteIndex.get(key) ?? 0));
  mount(
    stage,
    renderDiagram(
      scene.diagram,
      actionArrows(scene.diagram, scene.palette, drawn),
      (generator) => colourOf(elementKey(scene.palette[generator])) ?? "currentColor",
    ),
  );
  mount(
    latticeHost,
    renderLattice(
      scene.latticeDiagram,
      {
        selected: new Set(selection.keys()),
        completing: completingClasses(),
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
    const first = choicesFor(classIndex).elements[0];
    selection.set(classIndex, new Set(first === undefined ? [] : [elementKey(first.permutation)]));
  }
  draw();
};

const toggleElement = (key: string): void => {
  const classIndex = scene.classOfElement.get(key);
  if (classIndex === undefined) return;
  const keys = selection.get(classIndex);
  if (keys === undefined) return;
  if (keys.has(key)) keys.delete(key);
  else keys.add(key);
  draw();
};

/** Open a scene with one generator already drawn, so the diagram is never bare. */
/**
 * The class in `to` that holds the image of this class's generator.
 *
 * A cyclic subgroup is pinned down by any one of its generators, so following
 * that one element is enough to find the class again on the other side.
 */
const mappedClass = (
  subgroupClass: SubgroupClass,
  isomorphism: GroupIsomorphism,
  to: Scene,
): number | undefined => {
  if (subgroupClass.generator === null) return undefined;
  const mapped = isomorphism.get(elementKey(subgroupClass.generator));
  if (mapped === undefined) return undefined;
  const key = elementKey(mapped);
  return to.selectableClasses.find(
    (index) =>
      to.lattice.classes[index].order === subgroupClass.order &&
      to.lattice.classes[index].conjugates.some((conjugate) =>
        conjugate.elements.some((element) => elementKey(element) === key),
      ),
  );
};

/**
 * The current selection, written in another representation of the same group.
 *
 * The two representations share no correspondence between their generators, so
 * the elements have to be carried across an isomorphism computed for the
 * purpose. Which isomorphism is not canonical — any two differ by an
 * automorphism — but every one of them preserves what the selection is for:
 * subgroups keep their order, and a set that generated the group still does.
 *
 * An element outside the target class's offered generators is dropped, leaving
 * its section open and empty, the same as clearing it by hand.
 */
const carrySelection = (from: Scene, to: Scene): Map<number, Set<string>> | null => {
  const isomorphism = findIsomorphism(
    from.representation.generators,
    from.representation.degree,
    to.representation.generators,
    to.representation.degree,
  );
  if (isomorphism === null) return null;

  const carried = new Map<number, Set<string>>();
  for (const [classIndex, keys] of selection) {
    const target = mappedClass(from.lattice.classes[classIndex], isomorphism, to);
    if (target === undefined) continue;
    const elements = [...keys]
      .map((key) => isomorphism.get(key))
      .filter((permutation) => permutation !== undefined)
      .map(elementKey)
      .filter((key) => to.classOfElement.get(key) === target);
    carried.set(target, new Set(elements));
  }
  return carried;
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
  showScene(buildScene(group, group.representations[0]), null);
  drawGroups();
}

function selectRepresentation(id: string): void {
  const representation =
    scene.group.representations.find((rep) => rep.id === id) ?? scene.group.representations[0];
  if (representation.id === scene.representation.id) return;
  const next = buildScene(scene.group, representation);
  showScene(next, carrySelection(scene, next));
}

search.addEventListener("input", () => {
  query = search.value;
  drawGroups();
});

// The diagram is laid out to a measured width, so a resized window wants a new
// layout rather than a scaled one — the nodes should keep their size.
window.addEventListener("resize", () => {
  scene = { ...scene, diagram: layoutDiagram(scene.orbits) };
  draw();
});

showScene(scene, null);
drawGroups();
