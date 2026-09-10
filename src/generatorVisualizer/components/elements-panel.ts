import { el } from "@shared/dom";
import { formatPermutation, type Permutation } from "@shared/mathUtils/groups/permutations";
import type { GeneratorChoices } from "@shared/mathUtils/groups/generatorChoices";

/** One selected subgroup class, and the generators it offers. */
export interface ElementSection {
  /** Index into `SubgroupLattice.classes`. */
  classIndex: number;
  label: string;
  /** Number of conjugate subgroups in the class. */
  conjugateCount: number;
  choices: GeneratorChoices;
}

export interface ElementSelectionView {
  isSelected: (key: string) => boolean;
  /** The colour this element is drawn in, or null when it is not being drawn. */
  colourOf: (key: string) => string | null;
  onToggle: (key: string) => void;
}

/** Identifies an element by its one-line form, which is unique within a group. */
export const elementKey = (permutation: Permutation): string => permutation.join(",");

const elementRow = (permutation: Permutation, view: ElementSelectionView): HTMLElement => {
  const key = elementKey(permutation);
  const input = el("input", { type: "checkbox", checked: view.isSelected(key) });
  input.addEventListener("change", () => {
    view.onToggle(key);
  });

  const swatch = el("span", { className: "swatch" });
  // An unselected element has no colour yet: colours are spread over the
  // selection, so which one it would take depends on what else is drawn.
  swatch.style.background = view.colourOf(key) ?? "currentColor";

  const row = el("label", { className: "element" }, [
    input,
    swatch,
    el("code", {}, [formatPermutation(permutation)]),
  ]);
  row.dataset.element = key;
  return row;
};

const conjugateGroup = (
  section: ElementSection,
  conjugate: number,
  view: ElementSelectionView,
): HTMLElement =>
  el("div", { className: "conjugate" }, [
    el("h4", {}, [`Conjugate ${conjugate + 1}`]),
    ...section.choices.elements
      .filter((choice) => choice.conjugate === conjugate)
      .map((choice) => elementRow(choice.permutation, view)),
  ]);

const sectionBlock = (section: ElementSection, view: ElementSelectionView): HTMLElement => {
  const { elements, total } = section.choices;
  const heading = el("h3", {}, [
    section.label,
    el("span", { className: "muted" }, [
      total === elements.length
        ? ` ${total} generator${total === 1 ? "" : "s"}`
        : ` ${elements.length} of ${total} generators`,
    ]),
  ]);

  // Which conjugate an element generates decides what it adds to a selection, so
  // elements are grouped by it rather than listed as one undifferentiated set.
  const body =
    section.conjugateCount > 1
      ? [...new Set(elements.map((choice) => choice.conjugate))].map((conjugate) =>
          conjugateGroup(section, conjugate, view),
        )
      : elements.map((choice) => elementRow(choice.permutation, view));

  const block = el("section", { className: "element-section" }, [heading, ...body]);
  block.dataset.class = String(section.classIndex);
  return block;
};

/** The right-hand panel: one section per selected subgroup class. */
export const renderElementSections = (
  sections: readonly ElementSection[],
  view: ElementSelectionView,
): HTMLElement =>
  sections.length === 0
    ? el("p", { className: "placeholder" }, [
        "Select a subgroup in the diagram to choose which of its generators to draw.",
      ])
    : el(
        "div",
        { className: "element-sections" },
        sections.map((section) => sectionBlock(section, view)),
      );
