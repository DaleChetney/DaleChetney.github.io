// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import type { GeneratorChoices } from "@shared/mathUtils/groups/generatorChoices";
import { permutationKey } from "@shared/mathUtils/groups/permutations";
import {
  PAGE_SIZE,
  renderElementSections,
  type ElementSection,
  type ElementSelectionView,
} from "./elements-panel";

const choices = (spec: readonly (readonly [number[], number])[]): GeneratorChoices => ({
  elements: spec.map(([permutation, conjugate]) => ({ permutation, conjugate })),
});

/** The kth power of the 31-cycle (1 2 … 31). */
const power31 = (k: number) => Array.from({ length: 31 }, (_, i) => ((i + k) % 31) + 1);

/** C₃₁, whose 30 generators are the powers 1 to 30 of that cycle. */
const c31: Partial<ElementSection> = {
  label: "C₃₁",
  letter: "c",
  conjugateCount: 1,
  choices: choices(Array.from({ length: 30 }, (_, k) => [power31(k + 1), 0] as const)),
};

const namesIn = (root: HTMLElement) =>
  [...root.querySelectorAll(".element code")].map((code) => code.textContent);

const section = (over: Partial<ElementSection> = {}): ElementSection => ({
  classIndex: 3,
  label: "₃C₄",
  letter: "b",
  page: 0,
  conjugateCount: 3,
  choices: choices([
    [[1, 3, 2, 5, 6, 7, 4], 0],
    [[1, 3, 2, 7, 4, 5, 6], 0],
    [[2, 1, 3, 5, 6, 7, 4], 1],
  ]),
  ...over,
});

const view = (over: Partial<ElementSelectionView> = {}): ElementSelectionView => ({
  isSelected: () => false,
  colorOf: () => "#c1436d",
  onToggle: () => {},
  onPage: () => {},
  ...over,
});

describe("renderElementSections", () => {
  it("prompts when nothing is selected", () => {
    const root = renderElementSections([], view());
    expect(root.querySelector(".element-sections")).toBeNull();
    expect(root.textContent).toContain("Select a subgroup");
  });

  it("renders one block per section, tagged with its class", () => {
    const root = renderElementSections([section(), section({ classIndex: 4 })], view());
    expect(root.querySelectorAll(".element-section")).toHaveLength(2);
    expect(root.querySelector('[data-class="4"]')).not.toBeNull();
  });

  it("groups elements by conjugate when the class has several", () => {
    const root = renderElementSections([section()], view());
    expect(root.querySelectorAll(".conjugate")).toHaveLength(2);
    expect(root.querySelectorAll(".element")).toHaveLength(3);
  });

  it("lists elements flat when the class has a single conjugate", () => {
    const root = renderElementSections(
      [
        section({
          label: "C₆",
          conjugateCount: 1,
          choices: choices([[[1, 2, 3, 4, 5, 6, 7], 0]]),
        }),
      ],
      view(),
    );
    expect(root.querySelectorAll(".conjugate")).toHaveLength(0);
    expect(root.querySelectorAll(".element")).toHaveLength(1);
  });

  it("counts the generators offered", () => {
    const root = renderElementSections([section()], view());
    expect(root.querySelector(".muted")?.textContent).toContain("3 generators");
  });

  it("needs no pager when every generator fits on one page", () => {
    const root = renderElementSections([section()], view());
    expect(root.querySelector(".pager")).toBeNull();
  });

  it("lists one page of generators at a time, and says which", () => {
    const root = renderElementSections([section({ ...c31, page: 1 })], view());
    expect(root.querySelector(".muted")?.textContent).toContain("30 generators");
    expect(root.querySelector(".pager-range")?.textContent).toBe("13–24 of 30");
    const names = namesIn(root);
    expect(names).toHaveLength(PAGE_SIZE);
    expect(names[0]).toBe("c¹³");
  });

  it("lists what is left on the last page, and cannot step past it", () => {
    const root = renderElementSections([section({ ...c31, page: 2 })], view());
    expect(root.querySelector(".pager-range")?.textContent).toBe("25–30 of 30");
    expect(namesIn(root)).toHaveLength(6);
    expect(root.querySelector<HTMLButtonElement>('[data-step="next"]')?.disabled).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('[data-step="previous"]')?.disabled).toBe(false);
  });

  it("keeps a page that no longer exists in range", () => {
    const root = renderElementSections([section({ ...c31, page: 9 })], view());
    expect(root.querySelector(".pager-range")?.textContent).toBe("25–30 of 30");
  });

  it("asks for the page it steps to", () => {
    const onPage = vi.fn();
    const root = renderElementSections([section({ ...c31, page: 1 })], view({ onPage }));
    root.querySelector<HTMLButtonElement>('[data-step="next"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-step="previous"]')?.click();
    expect(onPage.mock.calls).toEqual([
      [3, 2],
      [3, 0],
    ]);
  });

  it("names each element as a power of its conjugate's first", () => {
    const root = renderElementSections([section()], view());
    expect(namesIn(root)).toEqual(["b₁", "b₁³", "b₂"]);
  });

  it("keeps the cycle notation for a hover, and reflects the selection", () => {
    const chosen = permutationKey([1, 3, 2, 5, 6, 7, 4]);
    const root = renderElementSections([section()], view({ isSelected: (key) => key === chosen }));
    const row = root.querySelector<HTMLElement>(`[data-element="${chosen}"]`);
    expect(row?.title).toBe("(2 3)(4 5 6 7)");
    expect(row?.querySelector<HTMLInputElement>("input")?.checked).toBe(true);
    expect(root.querySelectorAll<HTMLInputElement>("input:checked")).toHaveLength(1);
  });

  it("toggles the element it was clicked on", () => {
    const onToggle = vi.fn();
    const root = renderElementSections([section()], view({ onToggle }));
    // jsdom only runs a checkbox's activation behaviour once it is connected.
    document.body.replaceChildren(root);
    const key = permutationKey([2, 1, 3, 5, 6, 7, 4]);
    root.querySelector<HTMLInputElement>(`[data-element="${key}"] input`)?.click();
    expect(onToggle).toHaveBeenCalledWith(key);
  });
});
