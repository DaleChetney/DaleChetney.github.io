import { el } from "@shared/dom";
import {
  formatPermutation,
  permutationKey,
  type Permutation,
} from "@shared/mathUtils/groups/permutations";
import type { GeneratorChoices, GeneratorElement } from "@shared/mathUtils/groups/generatorChoices";
import { generatorNames } from "./generatorNames";

/** How many generators a section lists at once. */
export const PAGE_SIZE = 12;

/** One selected subgroup class, and the generators it offers. */
export interface ElementSection {
  /** Index into `SubgroupLattice.classes`. */
  classIndex: number;
  label: string;
  /** The letter its generators are named by, as `a` in `a²`. */
  letter: string;
  /** Number of conjugate subgroups in the class. */
  conjugateCount: number;
  choices: GeneratorChoices;
  /** Which page of `PAGE_SIZE` generators to list, from 0; kept in range when drawn. */
  page: number;
}

export interface ElementSelectionView {
  isSelected: (key: string) => boolean;
  /** The color this element is drawn in, or null when it is not being drawn. */
  colorOf: (key: string) => string | null;
  onToggle: (key: string) => void;
  /** Turn a section to another page. */
  onPage: (classIndex: number, page: number) => void;
}

const elementRow = (
  permutation: Permutation,
  names: Map<string, string>,
  view: ElementSelectionView,
): HTMLElement => {
  const key = permutationKey(permutation);
  const input = el("input", { type: "checkbox", checked: view.isSelected(key) });
  input.addEventListener("change", () => {
    view.onToggle(key);
  });

  const swatch = el("span", { className: "swatch" });
  // An unselected element has no color yet: colors are spread over the
  // selection, so which one it would take depends on what else is drawn.
  swatch.style.background = view.colorOf(key) ?? "currentColor";

  // The full permutation is too long to list, so the row names the element as
  // a power of its conjugate's first generator and keeps the cycles for a hover.
  const cycles = formatPermutation(permutation);
  const row = el("label", { className: "element", title: cycles }, [
    input,
    swatch,
    el("code", {}, [names.get(key) ?? cycles]),
  ]);
  row.dataset.element = key;
  return row;
};

const conjugateGroup = (
  shown: readonly GeneratorElement[],
  conjugate: number,
  names: Map<string, string>,
  view: ElementSelectionView,
): HTMLElement =>
  el("div", { className: "conjugate" }, [
    el("h4", {}, [`Conjugate ${conjugate + 1}`]),
    ...shown
      .filter((choice) => choice.conjugate === conjugate)
      .map((choice) => elementRow(choice.permutation, names, view)),
  ]);

/**
 * Steps between pages, with the range on show between them. Each button carries
 * the direction it steps, which is what lets focus survive the redraw it causes.
 */
const pager = (
  section: ElementSection,
  page: number,
  pageCount: number,
  view: ElementSelectionView,
): HTMLElement => {
  const total = section.choices.elements.length;
  const step = (direction: "previous" | "next", glyph: string, target: number) => {
    const button = el(
      "button",
      {
        type: "button",
        className: "pager-step",
        disabled: target < 0 || target >= pageCount,
      },
      [glyph],
    );
    button.setAttribute(
      "aria-label",
      `${direction === "previous" ? "Previous" : "Next"} generators`,
    );
    button.dataset.step = direction;
    button.addEventListener("click", () => {
      view.onPage(section.classIndex, target);
    });
    return button;
  };
  const first = page * PAGE_SIZE + 1;
  const last = Math.min(total, first + PAGE_SIZE - 1);
  return el("div", { className: "pager" }, [
    step("previous", "‹", page - 1),
    el("span", { className: "pager-range" }, [`${first}–${last} of ${total}`]),
    step("next", "›", page + 1),
  ]);
};

const sectionBlock = (section: ElementSection, view: ElementSelectionView): HTMLElement => {
  const { elements } = section.choices;
  // Named over the whole class, not the page, since a conjugate's first
  // generator, which the rest are powers of, may be on an earlier page.
  const names = generatorNames(section.letter, section.choices, section.conjugateCount);
  const heading = el("h3", {}, [
    section.label,
    el("span", { className: "muted" }, [
      ` ${elements.length} generator${elements.length === 1 ? "" : "s"}`,
    ]),
  ]);

  const pageCount = Math.max(1, Math.ceil(elements.length / PAGE_SIZE));
  const page = Math.min(Math.max(section.page, 0), pageCount - 1);
  const shown = elements.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Which conjugate an element generates decides what it adds to a selection, so
  // elements are grouped by it rather than listed as one undifferentiated set.
  const body =
    section.conjugateCount > 1
      ? [...new Set(shown.map((choice) => choice.conjugate))].map((conjugate) =>
          conjugateGroup(shown, conjugate, names, view),
        )
      : shown.map((choice) => elementRow(choice.permutation, names, view));

  const block = el("section", { className: "element-section" }, [
    heading,
    ...(pageCount > 1 ? [pager(section, page, pageCount, view)] : []),
    ...body,
  ]);
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
