// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import type { GeneratorChoices } from "@shared/mathUtils/groups/generatorChoices";
import { permutationKey } from "@shared/mathUtils/groups/permutations";
import {
  PAGE_SIZE,
  renderElementSections,
  type ElementSection,
  type ElementSelectionView,
} from "./elementsPanel";

const choices = (spec: readonly (readonly [number[], number, number])[]): GeneratorChoices => ({
  elements: spec.map(([permutation, conjugate, exponent]) => ({
    permutation,
    conjugate,
    exponent,
  })),
});

/** The kth power of the n-cycle (1 2 … n), shifted `offset` points along. */
const cyclePower = (n: number, k: number, offset = 0) =>
  Array.from({ length: n + offset }, (_, i) =>
    i < offset ? i + 1 : ((i - offset + k) % n) + offset + 1,
  );

/** The units mod n, each the exponent of one generator of Cₙ. */
const units = (n: number) =>
  Array.from({ length: n }, (_, k) => k).filter((k) => {
    let [a, b] = [k, n];
    while (b !== 0) [a, b] = [b, a % b];
    return a === 1;
  });

/** Cₙ's generators as powers of its n-cycle, one conjugate per offset. */
const cyclic = (n: number, offsets: readonly number[]): GeneratorChoices =>
  choices(
    offsets.flatMap((offset, conjugate) =>
      units(n).map((k) => [cyclePower(n, k, offset), conjugate, k] as const),
    ),
  );

/** C₃₁, whose 30 generators make a single orbit under ×3. */
const c31: Partial<ElementSection> = {
  label: "C₃₁",
  letter: "c",
  order: 31,
  autExponents: [3],
  conjugateCount: 1,
  choices: cyclic(31, [0]),
};

/** C₁₆, whose eight generators fall in two orbits under ×3 or four under ×15. */
const c16: Partial<ElementSection> = {
  label: "C₁₆",
  letter: "a",
  order: 16,
  autExponents: [15, 3],
  conjugateCount: 1,
  choices: cyclic(16, [0]),
};

const namesIn = (root: HTMLElement) =>
  [...root.querySelectorAll(".element code")].map((code) => code.textContent);

const section = (over: Partial<ElementSection> = {}): ElementSection => ({
  classIndex: 3,
  label: "₃C₄",
  letter: "b",
  page: 0,
  order: 4,
  autExponents: [3],
  orbits: new Map(),
  conjugateCount: 3,
  choices: choices([
    [[1, 3, 2, 5, 6, 7, 4], 0, 1],
    [[1, 3, 2, 7, 4, 5, 6], 0, 3],
    [[2, 1, 3, 5, 6, 7, 4], 1, 1],
  ]),
  ...over,
});

const view = (over: Partial<ElementSelectionView> = {}): ElementSelectionView => ({
  isSelected: () => false,
  colorOf: () => "#c1436d",
  onToggle: () => {},
  onPage: () => {},
  onOrbit: () => {},
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
          choices: choices([[[1, 2, 3, 4, 5, 6, 7], 0, 1]]),
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
    // The thirteenth step of the walk by ×3 is 3¹² = 8 mod 31.
    expect(names[0]).toBe("c⁸");
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

  it("arranges the generators by orbit under the largest automorphism", () => {
    const root = renderElementSections([section(c16)], view());
    expect(namesIn(root)).toEqual(["a", "a³", "a⁹", "a¹¹", "a¹⁵", "a¹³", "a⁷", "a⁵"]);
    const breaks = [...root.querySelectorAll(".orbit-break")];
    expect(breaks.map((b) => b.textContent)).toEqual(["coset 2"]);
    expect(breaks[0].nextElementSibling?.querySelector("code")?.textContent).toBe("a¹⁵");
  });

  it("arranges them by the automorphism chosen for the conjugate instead", () => {
    const root = renderElementSections([section({ ...c16, orbits: new Map([[0, 15]]) })], view());
    expect(namesIn(root)).toEqual(["a", "a¹⁵", "a³", "a¹³", "a⁹", "a⁷", "a¹¹", "a⁵"]);
    expect(root.querySelectorAll(".orbit-break")).toHaveLength(3);
    expect(root.querySelector<HTMLSelectElement>("select")?.value).toBe("15");
  });

  it("offers each conjugate its own choice of automorphism", () => {
    const onOrbit = vi.fn();
    const root = renderElementSections(
      [
        section({
          label: "₂C₈",
          order: 8,
          autExponents: [5, 3],
          conjugateCount: 2,
          choices: cyclic(8, [0, 8]),
        }),
      ],
      view({ onOrbit }),
    );
    const selects = [...root.querySelectorAll<HTMLSelectElement>(".conjugate select")];
    expect(selects).toHaveLength(2);
    expect([...selects[0].options].map((option) => option.textContent)).toEqual([
      "cosets under ×5",
      "cosets under ×3",
      "cosets under ×7",
    ]);
    // Equal orbits, so LMFDB's first is the default.
    expect(selects[1].value).toBe("5");
    selects[1].value = "3";
    selects[1].dispatchEvent(new Event("change"));
    expect(onOrbit).toHaveBeenCalledWith(3, 1, 3);
  });

  it("offers a choice for every cyclic subgroup of the automorphisms, even from one basis exponent", () => {
    const root = renderElementSections([section(c31)], view());
    const select = root.querySelector<HTMLSelectElement>("select");
    expect([...(select?.options ?? [])].map((option) => option.value)).toEqual([
      "3",
      "9",
      "27",
      "26",
      "16",
      "25",
      "30",
    ]);
    expect(select?.value).toBe("3");
    expect(root.querySelector(".orbit-break")).toBeNull();
  });

  it("arranges by a product of basis exponents", () => {
    // ⟨13⟩ = {1, 13, 9, 5}, and ×15 carries it to the other coset.
    const root = renderElementSections([section({ ...c16, orbits: new Map([[0, 13]]) })], view());
    expect(namesIn(root)).toEqual(["a", "a¹³", "a⁹", "a⁵", "a¹⁵", "a³", "a⁷", "a¹¹"]);
  });

  it("offers no choice for a conjugate of only two generators", () => {
    const root = renderElementSections(
      [
        section({
          label: "C₆",
          order: 6,
          autExponents: [5],
          conjugateCount: 1,
          choices: cyclic(6, [0]),
        }),
      ],
      view(),
    );
    expect(root.querySelector("select")).toBeNull();
  });
});
