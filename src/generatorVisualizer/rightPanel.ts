import { mount, preservingFocus, qs } from "@shared/dom";
import { classLabel } from "./components/classLabel";
import { renderElementSections, type ElementSection } from "./components/elements-panel";
import type { Scene } from "./scene";

/** Element rows are identified by the permutation they carry, which outlives a redraw. */
const elementFocus = (active: Element): string | null => {
  const element = active.closest("[data-element]")?.getAttribute("data-element");
  return element == null ? null : `[data-element="${element}"] input`;
};

/**
 * The right panel: one section per open subgroup class, listing the generators
 * that class offers and which of them are being drawn.
 *
 * It holds no state. What is open and what is drawn belong to the scene, so the
 * panel reads both from it at draw time; toggling an element is reported back to
 * the scene, which is what decides whether anything changed.
 */
export class RightPanel {
  readonly #onToggle: (key: string) => void;

  constructor(onToggle: (key: string) => void) {
    this.#onToggle = onToggle;
  }

  show(scene: Scene): void {
    preservingFocus(elementFocus, () => {
      mount(
        qs("#element-sections"),
        renderElementSections(sectionsOf(scene), {
          isSelected: (key) => scene.isDrawn(key),
          colourOf: (key) => scene.colourOf(key),
          onToggle: this.#onToggle,
        }),
      );
    });
  }
}

/**
 * The open classes as sections. Each is headed with the same name the lattice
 * node carries, so the two panels read as one selection.
 */
const sectionsOf = (scene: Scene): ElementSection[] =>
  scene.openClasses().map((classIndex) => ({
    classIndex,
    label: classLabel(scene.classAt(classIndex), scene.group.order, scene.group.displayName),
    conjugateCount: scene.classAt(classIndex).count,
    choices: scene.choicesFor(classIndex),
  }));
