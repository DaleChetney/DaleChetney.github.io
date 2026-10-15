// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { decodePermutation, permutationOrbits } from "@shared/mathUtils/groups/permutations";
import {
  actionArrows,
  arrowheadDefs,
  HEAD_ONLY_DISTANCE,
  renderArrows,
  shapeArrow,
  type ActionArrow,
  type BowWidth,
} from "./arrow";
import { layoutOrbits } from "./ringLayout";

const distinct = <T>(values: readonly T[]): number => new Set(values).size;

describe("actionArrows", () => {
  const generators = [129, 16, 840].map((code) => decodePermutation(code, 7));
  const { points } = layoutOrbits(permutationOrbits(generators, 7));

  it("emits nothing when no generator is drawn", () => {
    expect(actionArrows(points, [])).toEqual([]);
  });

  it("emits one arrow per moved point", () => {
    // Generator 0 is (2 3)(4 5 6 7): six moved points, one fixed.
    const arrows = actionArrows(points, [generators[0]]);
    expect(arrows).toHaveLength(6);
    expect(arrows.every((a) => a.from.point !== a.to.point)).toBe(true);
  });

  it("skips fixed points", () => {
    const arrows = actionArrows(points, [generators[2]]); // (1 2 3)
    expect(arrows.map((a) => a.from.point).sort()).toEqual([1, 2, 3]);
  });

  it("tags each arrow with the generator that produced it", () => {
    const arrows = actionArrows(points, [generators[0], generators[2]]);
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
  const colorOf = (generator: number): string => ["#aa1144", "#008866"][generator];
  const curvesOf = (layer: SVGGElement, selector = "path"): string[] =>
    Array.from(layer.querySelectorAll(selector)).map((path) => path.getAttribute("d") ?? "");

  const shared = renderArrows(actionArrows(points, overlapping), colorOf);

  it("draws every arrow it is given", () => {
    expect(shared.querySelectorAll("path")).toHaveLength(12);
  });

  it("draws every arrow at the same width", () => {
    const widths = Array.from(shared.querySelectorAll("path")).map((path) =>
      path.getAttribute("stroke-width"),
    );
    expect(distinct(widths)).toBe(1);
  });

  it("gives every arrow on one shared path a curve of its own", () => {
    const onePath = curvesOf(shared, 'path[data-from="4"][data-to="5"]');
    expect(onePath).toHaveLength(2);
    expect(distinct(onePath)).toBe(2);
  });

  it("bows each further arrow on a shared path further, on the same side", () => {
    const controlY = (stack: number): number => {
      const arrow = {
        generator: 0,
        from: { point: 1, x: 0, y: 0 },
        to: { point: 2, x: 400, y: 0 },
      };
      const layer = renderArrows(
        [arrow, { ...arrow, generator: 1 }, { ...arrow, generator: 2 }],
        colorOf,
      );
      const d = layer.querySelectorAll("path")[stack].getAttribute("d") ?? "";
      return Number(/Q -?[\d.]+ (-?[\d.]+)/.exec(d)?.[1]);
    };
    expect(controlY(0)).toBeGreaterThan(0);
    expect(controlY(1)).toBeGreaterThan(controlY(0));
    expect(controlY(2)).toBeGreaterThan(controlY(1));
  });

  it("leaves an arrow alone on its path at the chosen curvature", () => {
    const alone = renderArrows(actionArrows(points, [overlapping[0]]), colorOf);
    expect(curvesOf(alone)).toEqual(curvesOf(shared, '[data-generator="0"]'));
  });

  it("handles no arrows", () => {
    expect(renderArrows([], colorOf).querySelectorAll("path")).toHaveLength(0);
  });
});

describe("renderArrows curvature", () => {
  const from = { point: 1, x: 0, y: 0 };
  const to = { point: 2, x: 200, y: 0 };
  const arrow = { generator: 0, from, to };
  const colorOf = (): string => "#000";

  /** The control point of the one quadratic path drawn at this curvature. */
  const controlAt = (curvature: number): { x: number; y: number } => {
    const d = renderArrows([arrow], colorOf, curvature).querySelector("path")?.getAttribute("d");
    const match = /Q (-?[\d.]+) (-?[\d.]+)/.exec(d ?? "");
    if (match === null) throw new Error(`no quadratic in ${String(d)}`);
    return { x: Number(match[1]), y: Number(match[2]) };
  };

  it("bows the way it always has at curvature 1", () => {
    const control = controlAt(1);
    expect(control.x).toBe(100);
    expect(control.y).toBeGreaterThan(0);
  });

  it("draws a straight chord at curvature 0", () => {
    expect(controlAt(0)).toEqual({ x: 100, y: 0 });
  });

  it("bows the other way for a negative curvature", () => {
    expect(controlAt(-1).y).toBe(-controlAt(1).y);
  });

  it("bows further the larger the curvature", () => {
    expect(controlAt(2).y).toBe(2 * controlAt(1).y);
  });

  it("defaults to curvature 1", () => {
    const d = renderArrows([arrow], colorOf).querySelector("path")?.getAttribute("d");
    expect(d).toBe(renderArrows([arrow], colorOf, 1).querySelector("path")?.getAttribute("d"));
  });
});

describe("renderArrows bow width", () => {
  const colorOf = (): string => "#000";

  /** How far the one arrow of this length bows from its chord, at curvature 1. */
  const bowAt = (length: number, width?: BowWidth): number => {
    const arrow = {
      generator: 0,
      from: { point: 1, x: 0, y: 0 },
      to: { point: 2, x: length, y: 0 },
    };
    const d = renderArrows([arrow], colorOf, 1, width).querySelector("path")?.getAttribute("d");
    const match = /Q -?[\d.]+ (-?[\d.]+)/.exec(d ?? "");
    if (match === null) throw new Error(`no quadratic in ${String(d)}`);
    return Number(match[1]);
  };

  it("defaults to constant width", () => {
    expect(bowAt(600)).toBe(bowAt(600, "constant"));
  });

  it("caps the bow of a long arrow at constant width", () => {
    expect(bowAt(600, "constant")).toBe(bowAt(1200, "constant"));
  });

  it("keeps a long arrow's bow in proportion at relative width", () => {
    expect(bowAt(1200, "relative")).toBeGreaterThan(bowAt(600, "relative"));
    expect(bowAt(600, "relative")).toBeGreaterThan(bowAt(600, "constant"));
  });

  it("bows a short arrow the same either way", () => {
    expect(bowAt(100, "relative")).toBe(bowAt(100, "constant"));
  });
});

describe("renderArrows between close nodes", () => {
  const colorOf = (): string => "#000";
  const arrowOf = (length: number): ActionArrow => ({
    generator: 0,
    from: { point: 1, x: 0, y: 0 },
    to: { point: 2, x: length, y: 0 },
  });
  const drawn = (length: number): SVGPathElement => {
    const path = renderArrows([arrowOf(length)], colorOf).querySelector("path");
    if (path === null) throw new Error("no arrow drawn");
    return path;
  };
  /** The point a path's quadratic ends at. */
  const endOf = (path: SVGPathElement): { x: number; y: number } => {
    const numbers =
      path
        .getAttribute("d")
        ?.match(/-?[\d.e-]+/g)
        ?.map(Number) ?? [];
    return { x: numbers[4], y: numbers[5] };
  };

  it("draws the stroke and the end-of-arrow head when the nodes are far apart", () => {
    const path = drawn(HEAD_ONLY_DISTANCE * 2);
    expect(path.getAttribute("stroke-opacity")).toBe("1");
    expect(path.getAttribute("marker-end")).toBe("url(#arrowhead-0)");
  });

  it("hides the stroke and centers the head when the nodes are close", () => {
    const path = drawn(HEAD_ONLY_DISTANCE / 2);
    expect(path.getAttribute("stroke-opacity")).toBe("0");
    expect(path.getAttribute("marker-end")).toBe("url(#arrowhead-mid-0)");
  });

  it("puts a head-only arrow halfway along the curve, on its bowed side", () => {
    const length = HEAD_ONLY_DISTANCE / 2;
    const end = endOf(drawn(length));
    expect(end.x).toBeCloseTo(length / 2);
    expect(end.y).toBeGreaterThan(0);
  });

  it("switches between the two as a drawn arrow's nodes move", () => {
    const path = drawn(HEAD_ONLY_DISTANCE * 2);
    shapeArrow(path, arrowOf(HEAD_ONLY_DISTANCE / 2));
    expect(path.getAttribute("stroke-opacity")).toBe("0");
    shapeArrow(path, arrowOf(HEAD_ONLY_DISTANCE * 2));
    expect(path.getAttribute("stroke-opacity")).toBe("1");
    expect(path.getAttribute("marker-end")).toBe("url(#arrowhead-0)");
  });

  it("defines a centered head for every generator drawn", () => {
    const defs = arrowheadDefs([arrowOf(10)], colorOf);
    expect(defs.querySelector("#arrowhead-mid-0")?.getAttribute("refX")).toBe("5");
  });
});

describe("renderArrows with the head in the middle", () => {
  const colorOf = (): string => "#000";
  const arrowOf = (length: number): ActionArrow => ({
    generator: 0,
    from: { point: 1, x: 0, y: 0 },
    to: { point: 2, x: length, y: 0 },
  });
  const drawn = (length: number, curvature = 1): SVGPathElement => {
    const path = renderArrows(
      [arrowOf(length)],
      colorOf,
      curvature,
      "constant",
      "middle",
    ).querySelector("path");
    if (path === null) throw new Error("no arrow drawn");
    return path;
  };
  const numbersOf = (path: SVGPathElement): number[] =>
    path
      .getAttribute("d")
      ?.match(/-?[\d.e-]+/g)
      ?.map(Number) ?? [];

  it("keeps the stroke, with the centered head on its middle vertex and none at the end", () => {
    const path = drawn(HEAD_ONLY_DISTANCE * 4);
    expect(path.getAttribute("stroke-opacity")).toBe("1");
    expect(path.getAttribute("marker-mid")).toBe("url(#arrowhead-mid-0)");
    expect(path.getAttribute("marker-end")).toBe("none");
  });

  it("splits the curve into two quadratics that meet halfway between the nodes", () => {
    const d = drawn(HEAD_ONLY_DISTANCE * 4).getAttribute("d") ?? "";
    expect(d.match(/Q/g)).toHaveLength(2);
    const numbers = numbersOf(drawn(HEAD_ONLY_DISTANCE * 4));
    expect(numbers[4]).toBeCloseTo(HEAD_ONLY_DISTANCE * 2);
    expect(numbers[5]).toBeGreaterThan(0);
  });

  it("stops the stroke as short of the node it points to as of the one it leaves", () => {
    const numbers = numbersOf(drawn(HEAD_ONLY_DISTANCE * 4, 0));
    const [startX, , , , , , , , endX] = numbers;
    expect(HEAD_ONLY_DISTANCE * 4 - endX).toBeCloseTo(startX);
  });

  it("still draws the head alone between close nodes", () => {
    const path = drawn(HEAD_ONLY_DISTANCE / 2);
    expect(path.getAttribute("stroke-opacity")).toBe("0");
    expect(path.getAttribute("marker-mid")).toBe("none");
    expect(path.getAttribute("marker-end")).toBe("url(#arrowhead-mid-0)");
  });

  it("moves the head back to the end when asked", () => {
    const path = drawn(HEAD_ONLY_DISTANCE * 4);
    shapeArrow(path, arrowOf(HEAD_ONLY_DISTANCE * 4), 1, "constant", "end");
    expect(path.getAttribute("marker-mid")).toBe("none");
    expect(path.getAttribute("marker-end")).toBe("url(#arrowhead-0)");
  });
});

describe("renderArrows on hover", () => {
  // (2 3)(4 5 6 7) and (1 2 3): six arrows of one generator, three of the other.
  const generators = [
    [1, 3, 2, 5, 6, 7, 4],
    [2, 3, 1, 4, 5, 6, 7],
  ];
  const { points } = layoutOrbits([
    [1, 2, 3],
    [4, 5, 6, 7],
  ]);
  const colorOf = (generator: number): string => ["#aa1144", "#008866"][generator];
  const draw = (): SVGGElement => renderArrows(actionArrows(points, generators), colorOf);
  const pathsOf = (layer: SVGGElement): SVGPathElement[] =>
    Array.from(layer.querySelectorAll("path"));
  const generatorsOf = (layer: SVGGElement): number[] =>
    pathsOf(layer).map((path) => Number(path.dataset.generator));
  const ofGenerator = (layer: SVGGElement, generator: number): SVGPathElement => {
    const path = layer.querySelector<SVGPathElement>(`path[data-generator="${generator}"]`);
    if (path === null) throw new Error(`no arrow of generator ${generator}`);
    return path;
  };
  const over = (path: Element): void => {
    path.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
  };
  const leave = (layer: SVGGElement): void => {
    layer.dispatchEvent(new PointerEvent("pointerleave"));
  };

  it("brings every arrow of the hovered generator to the top", () => {
    const layer = draw();
    expect(generatorsOf(layer).at(-1)).toBe(1);
    over(ofGenerator(layer, 0));
    expect(generatorsOf(layer).slice(-6)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it("never moves the hovered generator's own arrows, so the browser keeps track of them", async () => {
    const layer = draw();
    const removed: Node[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) removed.push(...record.removedNodes);
    });
    observer.observe(layer, { childList: true });
    over(ofGenerator(layer, 0));
    await Promise.resolve();
    observer.disconnect();
    expect(removed.length).toBeGreaterThan(0);
    expect(removed.every((node) => (node as SVGPathElement).dataset.generator === "1")).toBe(true);
  });

  it("marks the hovered generator's arrows, and only those, as focused", () => {
    const layer = draw();
    over(ofGenerator(layer, 0));
    expect(layer.dataset.focus).toBe("0");
    for (const path of pathsOf(layer)) {
      expect(path.classList.contains("focused")).toBe(path.dataset.generator === "0");
    }
  });

  it("switches focus when the pointer moves to another generator's arrow", () => {
    const layer = draw();
    over(ofGenerator(layer, 0));
    over(ofGenerator(layer, 1));
    expect(layer.dataset.focus).toBe("1");
    expect(generatorsOf(layer).slice(-3)).toEqual([1, 1, 1]);
  });

  it("restores the drawing order and drops the focus when the pointer leaves", () => {
    const layer = draw();
    const before = pathsOf(layer);
    over(ofGenerator(layer, 0));
    leave(layer);
    expect(pathsOf(layer)).toEqual(before);
    expect(layer.dataset.focus).toBeUndefined();
    expect(layer.querySelector(".focused")).toBeNull();
  });
});
