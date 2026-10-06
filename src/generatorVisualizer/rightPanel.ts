import { mount, preservingFocus, qs } from "@shared/dom";
import { classLabel } from "./components/classLabel";
import { classLetter } from "./components/generatorNames";
import { renderElementSections, type ElementSection } from "./components/elements-panel";
import type { Scene } from "./scene";

/**
 * Element rows are identified by the permutation they carry, page steps by
 * their section's class and the way they step, and orbit choices by their
 * section's class and their conjugate, all of which outlive a redraw.
 */
const elementFocus = (active: Element): string | null => {
  const element = active.closest("[data-element]")?.getAttribute("data-element");
  if (element != null) return `[data-element="${element}"] input`;
  const section = active.closest("[data-class]")?.getAttribute("data-class");
  if (section == null) return null;
  const step = active.closest("[data-step]")?.getAttribute("data-step");
  if (step != null) return `[data-class="${section}"] [data-step="${step}"]`;
  const orbit = active.closest("[data-orbit]")?.getAttribute("data-orbit");
  return orbit == null ? null : `[data-class="${section}"] [data-orbit="${orbit}"]`;
};

/**
 * The right panel: one section per open subgroup class, listing the generators
 * that class offers and which of them are being drawn.
 *
 * What is open and what is drawn belong to the scene, so the panel reads both
 * from it at draw time; toggling an element is reported back to the scene,
 * which is what decides whether anything changed. The only state it keeps is
 * which page each section is turned to and which automorphism each conjugate
 * is arranged under, neither of which draws anything differently and so is no
 * business of the scene's. A new scene starts every section back at its first
 * page, arranged under its largest orbits.
 */
export class RightPanel {
  readonly #onToggle: (key: string) => void;
  #scene: Scene | null = null;
  /** The page each section is turned to, by class; a section not in it is on its first. */
  readonly #pages = new Map<number, number>();
  /** The exponent each conjugate is arranged under, by class, then conjugate. */
  readonly #orbits = new Map<number, Map<number, number>>();

  constructor(onToggle: (key: string) => void) {
    this.#onToggle = onToggle;
  }

  show(scene: Scene): void {
    if (scene !== this.#scene) {
      this.#pages.clear();
      this.#orbits.clear();
    }
    this.#scene = scene;
    preservingFocus(elementFocus, () => {
      mount(
        qs("#element-sections"),
        renderElementSections(sectionsOf(scene, this.#pages, this.#orbits), {
          isSelected: (key) => scene.isDrawn(key),
          colorOf: (key) => scene.colorOf(key),
          onToggle: this.#onToggle,
          onPage: (classIndex, page) => {
            this.#pages.set(classIndex, page);
            this.show(scene);
          },
          onOrbit: (classIndex, conjugate, exponent) => {
            const orbits = this.#orbits.get(classIndex) ?? new Map<number, number>();
            orbits.set(conjugate, exponent);
            this.#orbits.set(classIndex, orbits);
            this.show(scene);
          },
        }),
      );
    });
  }
}

/**
 * The open classes as sections. Each is headed with the same name the lattice
 * node carries, so the two panels read as one selection. Its letter comes from
 * its place among every selectable class, not just the open ones, so a class
 * keeps its letter whatever else is opened or closed.
 */
const sectionsOf = (
  scene: Scene,
  pages: ReadonlyMap<number, number>,
  orbits: ReadonlyMap<number, ReadonlyMap<number, number>>,
): ElementSection[] =>
  scene.openClasses().map((classIndex) => ({
    classIndex,
    label: classLabel(scene.classAt(classIndex), scene.group.order, scene.group.displayName),
    letter: classLetter(scene.selectableClasses.indexOf(classIndex)),
    conjugateCount: scene.classAt(classIndex).count,
    order: scene.classAt(classIndex).order,
    autExponents: scene.autExponentsFor(classIndex),
    orbits: orbits.get(classIndex) ?? new Map(),
    choices: scene.choicesFor(classIndex),
    page: pages.get(classIndex) ?? 0,
  }));
