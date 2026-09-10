// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import type { GeneratorChoices } from "@shared/mathUtils/groups/generatorChoices";
import { permutationKey } from "@shared/mathUtils/groups/permutations";
import {
  renderElementSections,
  type ElementSection,
  type ElementSelectionView,
} from "./elements-panel";

const choices = (
  spec: readonly (readonly [number[], number])[],
  total?: number,
): GeneratorChoices => ({
  elements: spec.map(([permutation, conjugate]) => ({ permutation, conjugate })),
  total: total ?? spec.length,
});

const section = (over: Partial<ElementSection> = {}): ElementSection => ({
  classIndex: 3,
  label: "₃C₄",
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
  colourOf: () => "#c1436d",
  onToggle: () => {},
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

  it("says so when the listing was capped", () => {
    const root = renderElementSections(
      [section({ choices: choices([[[1, 3, 2, 5, 6, 7, 4], 0]], 40) })],
      view(),
    );
    expect(root.querySelector(".muted")?.textContent).toContain("1 of 40");
  });

  it("shows cycle notation and reflects the selection", () => {
    const chosen = permutationKey([1, 3, 2, 5, 6, 7, 4]);
    const root = renderElementSections([section()], view({ isSelected: (key) => key === chosen }));
    const row = root.querySelector<HTMLElement>(`[data-element="${chosen}"]`);
    expect(row?.querySelector("code")?.textContent).toBe("(2 3)(4 5 6 7)");
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
