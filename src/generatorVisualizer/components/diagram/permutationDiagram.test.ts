// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { decodePermutation, permutationOrbits } from "@shared/mathUtils/groups/permutations";
import { actionArrows } from "./arrow";
import { renderPermutationDiagram } from "./permutationDiagram";
import { layoutOrbits } from "./ringLayout";

const generators = [129, 16, 840].map((code) => decodePermutation(code, 7));
const diagram = layoutOrbits(permutationOrbits(generators, 7));
const colours = ["#aa1144", "#008866", "#4455cc"];
const colourOf = (generator: number): string => colours[generator];
const render = (selected: number[]) =>
  renderPermutationDiagram(
    diagram,
    actionArrows(diagram.points, generators, new Set(selected)),
    colourOf,
  );

describe("renderPermutationDiagram", () => {
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
