// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import type { CatalogueRepresentation } from "../catalogue";
import { renderRepresentationRow } from "./representation-row";

const minimal: CatalogueRepresentation = {
  id: "perm-7",
  title: "Minimal faithful — degree 7",
  degree: 7,
  transitive: false,
  generators: [],
};

const transitive: CatalogueRepresentation = {
  id: "12T5",
  title: "12T5 — regular, degree 12",
  degree: 12,
  transitive: true,
  generators: [],
};

describe("how a representation is named on its button", () => {
  const labelOf = (representation: CatalogueRepresentation): string | null =>
    renderRepresentationRow([representation], { selected: "", onSelect: () => {} }).querySelector(
      "button",
    )?.textContent ?? null;

  it("names a transitive representation by LMFDB's label", () => {
    expect(labelOf(transitive)).toBe("12T5");
  });

  it("names the minimal faithful one by its degree, since perm-7 is an id", () => {
    expect(labelOf(minimal)).toBe("degree 7");
  });
});

describe("renderRepresentationRow", () => {
  const view = { selected: "perm-7", onSelect: () => {} };

  it("renders a button per representation, tagged with its id", () => {
    const root = renderRepresentationRow([minimal, transitive], view);
    expect(root.querySelectorAll(".representation")).toHaveLength(2);
    expect(root.querySelector('[data-representation="12T5"]')).not.toBeNull();
  });

  it("carries the full title as the tooltip", () => {
    const root = renderRepresentationRow([transitive], view);
    expect(root.querySelector<HTMLElement>(".representation")?.title).toBe(transitive.title);
  });

  it("marks exactly the selected one", () => {
    const root = renderRepresentationRow([minimal, transitive], view);
    const pressed = Array.from(root.querySelectorAll(".representation")).map((button) =>
      button.getAttribute("aria-pressed"),
    );
    expect(pressed).toEqual(["true", "false"]);
    expect(root.querySelectorAll(".representation.selected")).toHaveLength(1);
  });

  it("renders a single representation without complaint", () => {
    // 300 of the 526 groups have only the one.
    expect(
      renderRepresentationRow([minimal], view).querySelectorAll(".representation"),
    ).toHaveLength(1);
  });

  it("selects the representation it was clicked on", () => {
    const onSelect = vi.fn();
    const root = renderRepresentationRow([minimal, transitive], { ...view, onSelect });
    root.querySelector<HTMLElement>('[data-representation="12T5"]')?.click();
    expect(onSelect).toHaveBeenCalledWith("12T5");
  });
});
