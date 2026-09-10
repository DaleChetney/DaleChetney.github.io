// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { decodePermutation, permutationOrbits } from "@shared/mathUtils/groups/permutations";
import { actionArrows, renderArrows } from "./arrow";
import { layoutOrbits } from "./ringLayout";

const distinct = <T>(values: readonly T[]): number => new Set(values).size;

describe("actionArrows", () => {
  const generators = [129, 16, 840].map((code) => decodePermutation(code, 7));
  const { points } = layoutOrbits(permutationOrbits(generators, 7));

  it("emits nothing when no generator is selected", () => {
    expect(actionArrows(points, generators, new Set())).toEqual([]);
  });

  it("emits one arrow per moved point", () => {
    // Generator 0 is (2 3)(4 5 6 7): six moved points, one fixed.
    const arrows = actionArrows(points, generators, new Set([0]));
    expect(arrows).toHaveLength(6);
    expect(arrows.every((a) => a.from.point !== a.to.point)).toBe(true);
  });

  it("skips fixed points", () => {
    const arrows = actionArrows(points, generators, new Set([2])); // (1 2 3)
    expect(arrows.map((a) => a.from.point).sort()).toEqual([1, 2, 3]);
  });

  it("tags each arrow with the generator that produced it", () => {
    const arrows = actionArrows(points, generators, new Set([0, 2]));
    expect(distinct(arrows.map((a) => a.generator))).toBe(2);
    expect(arrows).toHaveLength(9); // 6 from (2 3)(4 5 6 7), 3 from (1 2 3)
  });
});

describe("renderArrows on a shared path", () => {
  // Two generators of different conjugate C_4 subgroups. Both contain the
  // 4-cycle (4 5 6 7), so four of each one's six arrows trace the same paths.
  const overlapping = [
    [1, 3, 2, 5, 6, 7, 4], // (2 3)(4 5 6 7)
    [2, 1, 3, 5, 6, 7, 4], // (1 2)(4 5 6 7)
  ];
  const { points } = layoutOrbits([
    [1, 2, 3],
    [4, 5, 6, 7],
  ]);
  const colourOf = (generator: number): string => ["#aa1144", "#008866"][generator];
  const widthsOf = (layer: SVGGElement, selector = "path"): number[] =>
    Array.from(layer.querySelectorAll(selector)).map((path) =>
      Number(path.getAttribute("stroke-width")),
    );

  const shared = renderArrows(actionArrows(points, overlapping, new Set([0, 1])), colourOf);

  it("draws every arrow it is given", () => {
    expect(shared.querySelectorAll("path")).toHaveLength(12);
  });

  it("leaves arrows that share no path all at the same width", () => {
    const alone = renderArrows(actionArrows(points, overlapping, new Set([0])), colourOf);
    expect(distinct(widthsOf(alone))).toBe(1);
  });

  it("widens only the arrows that share a path", () => {
    const widths = widthsOf(shared);
    const base = Math.min(...widths);
    // 12 arrows: four shared paths carrying two each, plus four unshared.
    expect(widths.filter((w) => w === base)).toHaveLength(8);
    expect(widths.filter((w) => w > base)).toHaveLength(4);
  });

  it("gives every arrow on one shared path a distinct width", () => {
    const onePath = widthsOf(shared, 'path[data-from="4"][data-to="5"]');
    expect(onePath).toHaveLength(2);
    expect(distinct(onePath)).toBe(2);
  });

  it("draws the widest first, so the narrower sits on top", () => {
    const widths = widthsOf(shared);
    expect([...widths].sort((a, b) => b - a)).toEqual(widths);
  });

  it("handles no arrows", () => {
    expect(renderArrows([], colourOf).querySelectorAll("path")).toHaveLength(0);
  });
});
