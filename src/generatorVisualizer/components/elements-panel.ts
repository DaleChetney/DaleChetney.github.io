import { el } from "@shared/dom";
import {
  formatPermutation,
  permutationKey,
  type Permutation,
} from "@shared/mathUtils/groups/permutations";
import {
  cyclicSubgroupExponents,
  largestOrbitExponent,
  orbitsUnder,
} from "@shared/mathUtils/groups/autOrbits";
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
  /** The order n of the cyclic subgroups in the class. */
  order: number;
  /** LMFDB's generators of Aut(Cₙ), as the exponents m of g ↦ gᵐ. */
  autExponents: readonly number[];
  /**
   * The exponent each conjugate's generators are arranged in orbits under, by
   * conjugate; a conjugate not in it is arranged under the largest-orbit one.
   */
  orbits: ReadonlyMap<number, number>;
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
  /** Arrange one conjugate's generators in orbits under another exponent. */
  onOrbit: (classIndex: number, conjugate: number, exponent: number) => void;
}

/** A generator in the order it is listed, and whether it starts a new orbit. */
interface Listed {
  choice: GeneratorElement;
  /** Its orbit's number, from 0, when it is the first of that orbit; else null. */
  startsOrbit: number | null;
}

/** The exponent a conjugate's generators are arranged under, if there is any choice. */
const orbitExponent = (section: ElementSection, conjugate: number): number | undefined =>
  section.orbits.get(conjugate) ?? largestOrbitExponent(section.order, section.autExponents);

/**
 * Every generator of the class in listing order: conjugate by conjugate, each
 * conjugate's arranged orbit by orbit. Only exponents are walked; each
 * generator already carries its own, so the walk just looks them up.
 */
const listing = (section: ElementSection): Listed[] => {
  const byConjugate = new Map<number, Map<number, GeneratorElement>>();
  for (const choice of section.choices.elements) {
    let byExponent = byConjugate.get(choice.conjugate);
    if (byExponent === undefined) {
      byExponent = new Map();
      byConjugate.set(choice.conjugate, byExponent);
    }
    byExponent.set(choice.exponent, choice);
  }
  return [...byConjugate].flatMap(([conjugate, byExponent]) =>
    orbitsUnder(section.order, section.autExponents, orbitExponent(section, conjugate)).flatMap(
      (orbit, index) =>
        orbit.flatMap((exponent, step) => {
          const choice = byExponent.get(exponent);
          return choice === undefined ? [] : [{ choice, startsOrbit: step === 0 ? index : null }];
        }),
    ),
  );
};

/**
 * A choice of which automorphism to arrange a conjugate's generators under:
 * one for each cyclic subgroup of Aut(Cₙ), largest first. Absent for a
 * conjugate of two generators or fewer, which only ever splits one way.
 */
const orbitPicker = (
  section: ElementSection,
  conjugate: number,
  view: ElementSelectionView,
): HTMLElement[] => {
  const generators = section.choices.elements.filter((choice) => choice.conjugate === conjugate);
  if (generators.length <= 2) return [];
  const chosen = orbitExponent(section, conjugate);
  const select = el(
    "select",
    { className: "orbit-select" },
    cyclicSubgroupExponents(section.order, section.autExponents).map((m) =>
      el("option", { value: String(m), selected: m === chosen }, [`cosets under ×${String(m)}`]),
    ),
  );
  select.setAttribute(
    "aria-label",
    section.conjugateCount > 1
      ? `Arrange conjugate ${String(conjugate + 1)}'s generators by coset`
      : "Arrange the generators by coset",
  );
  select.dataset.orbit = String(conjugate);
  select.addEventListener("change", () => {
    view.onOrbit(section.classIndex, conjugate, Number(select.value));
  });
  return [select];
};

/** The rows for some listed generators, with a break before each new orbit after the first. */
const rows = (
  listed: readonly Listed[],
  names: Map<string, string>,
  view: ElementSelectionView,
): HTMLElement[] =>
  listed.flatMap(({ choice, startsOrbit }) => [
    ...(startsOrbit !== null && startsOrbit > 0
      ? [el("div", { className: "orbit-break" }, [`coset ${String(startsOrbit + 1)}`])]
      : []),
    elementRow(choice.permutation, names, view),
  ]);

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
  section: ElementSection,
  shown: readonly Listed[],
  conjugate: number,
  names: Map<string, string>,
  view: ElementSelectionView,
): HTMLElement =>
  el("div", { className: "conjugate" }, [
    el("h4", {}, [`Conjugate ${String(conjugate + 1)}`]),
    ...orbitPicker(section, conjugate, view),
    ...rows(
      shown.filter(({ choice }) => choice.conjugate === conjugate),
      names,
      view,
    ),
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
  const names = generatorNames(section.letter, section.choices, section.conjugateCount);
  const heading = el("h3", {}, [
    section.label,
    el("span", { className: "muted" }, [
      ` ${elements.length} generator${elements.length === 1 ? "" : "s"}`,
    ]),
  ]);

  const pageCount = Math.max(1, Math.ceil(elements.length / PAGE_SIZE));
  const page = Math.min(Math.max(section.page, 0), pageCount - 1);
  const shown = listing(section).slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Which conjugate an element generates decides what it adds to a selection, so
  // elements are grouped by it rather than listed as one undifferentiated set.
  const body =
    section.conjugateCount > 1
      ? [...new Set(shown.map(({ choice }) => choice.conjugate))].map((conjugate) =>
          conjugateGroup(section, shown, conjugate, names, view),
        )
      : [...orbitPicker(section, 0, view), ...rows(shown, names, view)];

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
