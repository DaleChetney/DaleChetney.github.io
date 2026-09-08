// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { C3_C4 } from "./data";

// main.ts reaches into index.html by id and throws if one is missing, which no
// type check can see. Running it against the real markup pins the two together.
beforeAll(async () => {
  const html = readFileSync(resolve(import.meta.dirname, "index.html"), "utf8");
  document.body.innerHTML = /<body>([\s\S]*)<\/body>/.exec(html)?.[1] ?? "";
  await import("./main");
});

const latticeNode = (label: string): SVGGElement => {
  const found = Array.from(document.querySelectorAll<SVGGElement>(".lattice-node")).find(
    (node) => node.querySelector("text")?.textContent === label,
  );
  if (found === undefined) throw new Error(`no lattice node labelled ${label}`);
  return found;
};

const sectionFor = (label: string): HTMLElement => {
  const found = Array.from(document.querySelectorAll<HTMLElement>(".element-section")).find(
    (node) => node.querySelector("h3")?.firstChild?.textContent === label,
  );
  if (found === undefined) throw new Error(`no section for ${label}`);
  return found;
};

const sectionLabels = (): string[] =>
  Array.from(document.querySelectorAll(".element-section h3")).map(
    (h3) => h3.firstChild?.textContent ?? "",
  );
const completing = (): string[] =>
  Array.from(document.querySelectorAll(".lattice-node.completing text")).map(
    (text) => text.textContent ?? "",
  );
const checkedCount = (): number => document.querySelectorAll(".element input:checked").length;
const arrows = (): SVGPathElement[] =>
  Array.from(document.querySelectorAll("#diagram .edges path"));
const arrowColours = (): string[] => [
  ...new Set(arrows().map((path) => path.getAttribute("stroke") ?? "")),
];

/** Paths that share a from/to pair, grouped by that pair. */
const sharedPaths = (): SVGPathElement[][] => {
  const bundles = new Map<string, SVGPathElement[]>();
  for (const path of arrows()) {
    const key = `${path.getAttribute("data-from")}->${path.getAttribute("data-to")}`;
    bundles.set(key, [...(bundles.get(key) ?? []), path]);
  }
  return [...bundles.values()].filter((bundle) => bundle.length > 1);
};

describe("groups page", () => {
  it("mounts all three views", () => {
    expect(document.querySelector("#diagram svg")).not.toBeNull();
    expect(document.querySelector("#lattice svg")).not.toBeNull();
    expect(document.querySelector("#element-sections .element-sections")).not.toBeNull();
  });

  it("draws a node for every point of the default representation", () => {
    expect(document.querySelectorAll("#diagram .node")).toHaveLength(
      C3_C4.representations[0].degree,
    );
  });

  it("names the group", () => {
    expect(document.querySelector("#group-name")?.textContent).toBe(C3_C4.displayName);
    expect(document.querySelector("#group-label")?.textContent).toContain(C3_C4.label);
  });

  it("opens a section for the subgroup selected by default", () => {
    expect(sectionLabels()).toEqual(["C₆"]);
    // C_6 has one conjugate, so its two generators are listed flat.
    expect(sectionFor("C₆").querySelectorAll(".conjugate")).toHaveLength(0);
    expect(sectionFor("C₆").querySelectorAll(".element")).toHaveLength(2);
    expect(checkedCount()).toBe(1);
    expect(completing()).toEqual(["₃C₄"]);
  });

  it("colours only the swatches of the elements being drawn", () => {
    const swatches = Array.from(sectionFor("C₆").querySelectorAll<HTMLElement>(".element")).map(
      (row) => ({
        checked: row.querySelector<HTMLInputElement>("input")?.checked,
        background: row.querySelector<HTMLElement>(".swatch")?.style.background?.toLowerCase(),
      }),
    );
    // An unselected element has no colour: colours belong to the drawn series.
    expect(swatches.map((s) => s.checked)).toEqual([true, false]);
    expect(swatches[0].background).not.toBe("currentcolor");
    expect(swatches[1].background).toBe("currentcolor");
  });

  it("opens a second section, grouped by conjugate, when C_4 is selected", () => {
    latticeNode("₃C₄").dispatchEvent(new MouseEvent("click"));
    expect(sectionLabels().sort()).toEqual(["C₆", "₃C₄"].sort());
    const c4 = sectionFor("₃C₄");
    expect(c4.querySelectorAll(".conjugate")).toHaveLength(3);
    expect(c4.querySelectorAll(".element")).toHaveLength(6);
    expect(c4.querySelector(".muted")?.textContent).toContain("6 generators");
    // <C_6, C_4> is the whole group, so nothing is outstanding.
    expect(completing()).toEqual([]);
  });

  it("asks for more again once C_6 is dropped", () => {
    latticeNode("C₆").dispatchEvent(new MouseEvent("click"));
    expect(sectionLabels()).toEqual(["₃C₄"]);
    expect(checkedCount()).toBe(1);
    expect(completing().sort()).toEqual(["C₃", "C₆"]);
  });

  it("completes the group from two C_4 generators in different conjugates", () => {
    const groups = sectionFor("₃C₄").querySelectorAll(".conjugate");
    const second = groups[1].querySelector<HTMLInputElement>(".element input");
    second?.click();
    expect(checkedCount()).toBe(2);
    // Two order-4 elements generate C_3:C_4 exactly when their conjugates differ.
    expect(completing()).toEqual([]);
  });

  it("thins the arrows that now share a path", () => {
    // Both chosen generators contain the 4-cycle (4 5 6 7), so four arrows coincide.
    const bundles = sharedPaths();
    expect(bundles).toHaveLength(4);
    for (const bundle of bundles) {
      const widths = bundle.map((path) => Number(path.getAttribute("stroke-width")));
      expect(new Set(widths).size).toBe(widths.length);
    }
  });

  it("keeps the section open when its last element is cleared", () => {
    // Each click redraws the panel, so re-query rather than walking a snapshot.
    const nextChecked = () =>
      sectionFor("₃C₄").querySelector<HTMLInputElement>(".element input:checked");
    for (let input = nextChecked(); input !== null; input = nextChecked()) {
      input.click();
    }
    expect(sectionLabels()).toEqual(["₃C₄"]);
    expect(checkedCount()).toBe(0);
    expect(arrows()).toHaveLength(0);
  });

  it("keeps focus on a checkbox across the redraw it triggers", () => {
    latticeNode("C₆").dispatchEvent(new MouseEvent("click"));
    const input = sectionFor("C₆").querySelector<HTMLInputElement>(".element input");
    input?.focus();
    const key = input?.closest("[data-element]")?.getAttribute("data-element");
    input?.click();
    expect(document.activeElement?.closest("[data-element]")?.getAttribute("data-element")).toBe(
      key,
    );
    latticeNode("C₆").dispatchEvent(new MouseEvent("click"));
  });

  it("prompts again when every subgroup is dropped", () => {
    latticeNode("₃C₄").dispatchEvent(new MouseEvent("click"));
    expect(document.querySelectorAll(".element-section")).toHaveLength(0);
    expect(document.querySelector("#element-sections")?.textContent).toContain("Select a subgroup");
  });

  it("respreads the colours as the number of generators drawn changes", () => {
    const inputs = () =>
      Array.from(sectionFor("₃C₄").querySelectorAll<HTMLInputElement>(".element input"));
    latticeNode("₃C₄").dispatchEvent(new MouseEvent("click"));
    expect(arrowColours()).toHaveLength(1);

    // Elements 2 and 4 open the other two conjugates.
    inputs()[2].click();
    const two = arrowColours();
    expect(two).toHaveLength(2);

    inputs()[4].click();
    const three = arrowColours();
    expect(three).toHaveLength(3);
    // The wheel is re-divided rather than extended, so only the colour at the
    // start of it survives adding a third generator.
    expect(three.filter((colour) => two.includes(colour))).toHaveLength(1);
  });
});
