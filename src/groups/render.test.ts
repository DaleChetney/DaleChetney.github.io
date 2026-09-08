// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { decodePermutation, permutationOrbits } from "@shared/permutations";
import { actionArrows, layoutOrbits } from "./layout";
import { renderDiagram } from "./render";

const generators = [129, 16, 840].map((code) => decodePermutation(code, 7));
const diagram = layoutOrbits(permutationOrbits(generators, 7));
const colours = ["#aa1144", "#008866", "#4455cc"];
const colourOf = (generator: number): string => colours[generator];
const render = (selected: number[]) =>
  renderDiagram(diagram, actionArrows(diagram, generators, new Set(selected)), colourOf);

describe("renderDiagram", () => {
  it("draws one node per point", () => {
    expect(render([]).querySelectorAll(".node")).toHaveLength(7);
  });

  it("labels each node with its point", () => {
    const labels = Array.from(render([]).querySelectorAll(".node text")).map(
      (node) => node.textContent,
    );
    expect(labels.sort()).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
  });

  it("draws no edges when nothing is selected", () => {
    expect(render([]).querySelectorAll(".edges path")).toHaveLength(0);
  });

  it("draws one edge per moved point of the selected generator", () => {
    expect(render([0]).querySelectorAll(".edges path")).toHaveLength(6);
  });

  it("colours edges by generator and points them at a matching marker", () => {
    const root = render([0, 2]);
    const path = root.querySelector<SVGPathElement>('.edges path[data-generator="2"]');
    expect(path?.getAttribute("stroke")).toBe(colours[2]);
    expect(path?.getAttribute("marker-end")).toBe("url(#arrowhead-2)");
    expect(root.querySelector("#arrowhead-2")).not.toBeNull();
  });

  it("defines a marker only for the generators actually drawn", () => {
    expect(render([1]).querySelectorAll("defs marker")).toHaveLength(1);
  });

  it("gives the arrowhead the same colour as its edge", () => {
    const head = render([1]).querySelector("#arrowhead-1 path");
    expect(head?.getAttribute("fill")).toBe(colours[1]);
  });

  it("records the action on each edge", () => {
    // Generator 2 is (1 2 3), so 1 -> 2.
    const root = render([2]);
    const edge = root.querySelector('.edges path[data-from="1"]');
    expect(edge?.getAttribute("data-to")).toBe("2");
  });

  it("sizes the viewBox to the diagram", () => {
    expect(render([]).getAttribute("viewBox")).toBe(`0 0 ${diagram.width} ${diagram.height}`);
  });
});

describe("renderDiagram with overlapping arrows", () => {
  const overlapping = [
    [1, 3, 2, 5, 6, 7, 4], // (2 3)(4 5 6 7)
    [2, 1, 3, 5, 6, 7, 4], // (1 2)(4 5 6 7)
  ];
  const overlapDiagram = layoutOrbits([
    [1, 2, 3],
    [4, 5, 6, 7],
  ]);
  const root = renderDiagram(
    overlapDiagram,
    actionArrows(overlapDiagram, overlapping, new Set([0, 1])),
    colourOf,
  );
  const widthsOf = (selector: string): number[] =>
    Array.from(root.querySelectorAll(selector)).map((path) =>
      Number(path.getAttribute("stroke-width")),
    );

  it("draws both arrows on a shared path at different widths", () => {
    const shared = widthsOf('.edges path[data-from="4"][data-to="5"]');
    expect(shared).toHaveLength(2);
    expect(new Set(shared).size).toBe(2);
  });

  it("draws the widest first, so the narrower sits on top", () => {
    const widths = widthsOf(".edges path");
    expect([...widths].sort((a, b) => b - a)).toEqual(widths);
  });

  it("still draws every arrow", () => {
    expect(root.querySelectorAll(".edges path")).toHaveLength(12);
  });
});
