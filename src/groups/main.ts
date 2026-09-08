import { equidistantColours } from "@shared/colours";
import { mount, qs } from "@shared/dom";
import { permutationOrbits, type Permutation } from "@shared/permutations";
import {
  computeSubgroupLattice,
  generatesWholeGroup,
  generatorElements,
  type GeneratorChoices,
} from "@shared/subgroups";
import { C3_C4 } from "./data";
import { elementKey, renderElementSections, type ElementSection } from "./elements-panel";
import { actionArrows, layoutOrbits } from "./layout";
import { classLabel, layoutLattice, renderLattice } from "./lattice";
import { renderDiagram } from "./render";

/** How many generators a subgroup section will offer. */
const ELEMENT_LIMIT = 12;

const group = C3_C4;
// The left panel will choose this; until it exists, show the minimal faithful one.
const representation = group.representations[0];
const degree = representation.degree;
const diagram = layoutOrbits(permutationOrbits(representation.generators, degree));

const lattice = computeSubgroupLattice(representation.generators, degree);
const latticeDiagram = layoutLattice(lattice, group.order, group.displayName);

/**
 * Generators are chosen by clicking cyclic subgroups: a cyclic subgroup is
 * exactly one that has elements lying in no smaller subgroup. The trivial
 * subgroup offers nothing.
 */
const selectableClasses = lattice.classes
  .map((subgroupClass, index) => ({ subgroupClass, index }))
  .filter(({ subgroupClass }) => subgroupClass.cyclic && subgroupClass.order > 1)
  .map(({ index }) => index);

const choicesByClass = new Map<number, GeneratorChoices>(
  selectableClasses.map((index) => [
    index,
    generatorElements(lattice.classes[index], ELEMENT_LIMIT),
  ]),
);

const choicesFor = (classIndex: number): GeneratorChoices =>
  choicesByClass.get(classIndex) ?? { elements: [], total: 0 };

/**
 * Every choosable element, in a fixed order. A permutation generates exactly one
 * cyclic subgroup, so each appears once, and its position here orders the
 * selection for colouring — which keeps the assignment independent of the order
 * the elements happened to be clicked in.
 */
const palette = selectableClasses.flatMap((classIndex) =>
  choicesFor(classIndex).elements.map((choice) => choice.permutation),
);
const paletteIndex = new Map(palette.map((permutation, i) => [elementKey(permutation), i]));
const permutationFor = new Map(palette.map((p) => [elementKey(p), p]));
const classOfElement = new Map(
  selectableClasses.flatMap((classIndex) =>
    choicesFor(classIndex).elements.map((choice): [string, number] => [
      elementKey(choice.permutation),
      classIndex,
    ]),
  ),
);

/**
 * Chosen element keys, per selected class. A class with an empty set stays open:
 * clearing a section should not make it vanish under the pointer.
 */
const selection = new Map<number, Set<string>>();

const chosenKeys = (): string[] => [...selection.values()].flatMap((keys) => [...keys]);
const chosenPermutations = (): Permutation[] =>
  chosenKeys().map((key) => permutationFor.get(key) ?? []);

/**
 * A colour per drawn element, spread evenly over however many are drawn rather
 * than taken from a fixed list. Colours therefore shift as the selection grows,
 * but they stay as far apart as the count allows and never run out.
 */
const spreadColours = (): Map<string, string> => {
  const keys = chosenKeys().sort((a, b) => (paletteIndex.get(a) ?? 0) - (paletteIndex.get(b) ?? 0));
  const scale = equidistantColours(keys.length);
  return new Map(keys.map((key, index) => [key, scale[index]]));
};

let colours = new Map<string, string>();
const colourOf = (key: string): string | null => colours.get(key) ?? null;

/**
 * Classes offering an element that would complete the current choice into a
 * generating set. Existential over the class's elements rather than just its
 * first: which conjugate an element generates decides what it adds.
 */
const completingClasses = (): Set<number> => {
  const chosen = chosenPermutations();
  const completing = new Set<number>();
  if (generatesWholeGroup(chosen, degree, group.order)) return completing;
  for (const classIndex of selectableClasses) {
    if (selection.has(classIndex)) continue;
    const completes = choicesFor(classIndex).elements.some((choice) =>
      generatesWholeGroup([...chosen, choice.permutation], degree, group.order),
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
  selectableClasses
    .filter((classIndex) => selection.has(classIndex))
    .map((classIndex) => ({
      classIndex,
      label: classLabel(lattice.classes[classIndex], group.order, group.displayName),
      conjugateCount: lattice.classes[classIndex].count,
      choices: choicesFor(classIndex),
    }));

const stage = qs("#diagram");
const latticeHost = qs("#lattice");
const panel = qs("#element-sections");

/**
 * Redrawing replaces every node, which would drop focus after each toggle and
 * make the checkboxes unusable from the keyboard. Remember what had focus by a
 * selector that survives the rebuild, and restore it afterwards.
 */
const focusedSelector = (): string | null => {
  const active = document.activeElement;
  if (!(active instanceof Element)) return null;
  const element = active.closest("[data-element]")?.getAttribute("data-element");
  if (element != null) return `[data-element="${element}"] input`;
  const node = active.closest(".lattice-node[data-class]")?.getAttribute("data-class");
  return node == null ? null : `.lattice-node[data-class="${node}"]`;
};

const restoreFocus = (selector: string | null): void => {
  if (selector === null) return;
  const target = document.querySelector(selector);
  if (target instanceof HTMLElement || target instanceof SVGElement) target.focus();
};

const draw = (): void => {
  const focused = focusedSelector();
  colours = spreadColours();
  const drawn = new Set([...colours.keys()].map((key) => paletteIndex.get(key) ?? 0));
  mount(
    stage,
    renderDiagram(
      diagram,
      actionArrows(diagram, palette, drawn),
      (generator) => colourOf(elementKey(palette[generator])) ?? "currentColor",
    ),
  );
  mount(
    latticeHost,
    renderLattice(
      latticeDiagram,
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
  const classIndex = classOfElement.get(key);
  if (classIndex === undefined) return;
  const keys = selection.get(classIndex);
  if (keys === undefined) return;
  if (keys.has(key)) keys.delete(key);
  else keys.add(key);
  draw();
};

qs("#group-name").textContent = group.displayName;
qs("#group-label").textContent = `LMFDB ${group.label}`;
qs("#representation-title").textContent = representation.title;

toggleClass(selectableClasses[selectableClasses.length - 1]);
