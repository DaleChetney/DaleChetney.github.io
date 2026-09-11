// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { decodePermutation, permutationOrbits } from "@shared/mathUtils/groups/permutations";
import { actionArrows } from "./arrow";
import { renderPermutationDiagram, type DiagramView } from "./permutationDiagram";
import { layoutOrbits } from "./ringLayout";

const generators = [129, 16, 840].map((code) => decodePermutation(code, 7));
const diagram = layoutOrbits(permutationOrbits(generators, 7));
const colors = ["#aa1144", "#008866", "#4455cc"];
const colorOf = (generator: number): string => colors[generator];
/** Draw these generators; the arrows are numbered by position in the list given. */
const render = (drawn: number[], view: Partial<DiagramView> = {}) =>
  renderPermutationDiagram(
    diagram,
    actionArrows(
      diagram.points,
      drawn.map((generator) => generators[generator]),
    ),
    colorOf,
    { picked: null, onPick: () => {}, ...view },
  );
const node = (root: SVGSVGElement, point: number): SVGGElement => {
  const found = root.querySelector<SVGGElement>(`.node[data-point="${point}"]`);
  if (found === null) throw new Error(`no node for point ${point}`);
  return found;
};

describe("renderPermutationDiagram", () => {
  it("draws one node per point", () => {
    expect(render([]).querySelectorAll(".node")).toHaveLength(7);
  });

  it("draws the arrows after the nodes, so they are never hidden behind one", () => {
    const root = render([0]);
    const nodes = root.querySelector(".nodes");
    const edges = root.querySelector(".edges");
    expect(nodes).not.toBeNull();
    expect(edges).not.toBeNull();
    expect(nodes?.compareDocumentPosition(edges as Element)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("marks the picked node and no other", () => {
    expect(render([]).querySelectorAll(".node.picked")).toHaveLength(0);
    const root = render([], { picked: 3 });
    const picked = Array.from(root.querySelectorAll(".node.picked")).map((n) =>
      n.getAttribute("data-point"),
    );
    expect(picked).toEqual(["3"]);
  });

  it("reports a click on a node as a pick", () => {
    const onPick = vi.fn();
    node(render([], { onPick }), 5).dispatchEvent(new MouseEvent("click"));
    expect(onPick).toHaveBeenCalledWith(5);
  });

  it("reports Enter and Space on a focused node as a pick", () => {
    const onPick = vi.fn();
    const root = render([], { onPick });
    node(root, 2).dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    node(root, 4).dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    node(root, 6).dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    expect(onPick.mock.calls).toEqual([[2], [4]]);
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

  it("colors edges by generator and points them at a matching marker", () => {
    const root = render([0, 2]);
    const path = root.querySelector<SVGPathElement>('.edges path[data-generator="1"]');
    expect(path?.getAttribute("stroke")).toBe(colors[1]);
    expect(path?.getAttribute("marker-end")).toBe("url(#arrowhead-1)");
    expect(root.querySelector("#arrowhead-1")).not.toBeNull();
  });

  it("defines a marker only for the generators actually drawn", () => {
    expect(render([1]).querySelectorAll("defs marker")).toHaveLength(1);
  });

  it("gives the arrowhead the same color as its edge", () => {
    const head = render([1]).querySelector("#arrowhead-0 path");
    expect(head?.getAttribute("fill")).toBe(colors[0]);
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
