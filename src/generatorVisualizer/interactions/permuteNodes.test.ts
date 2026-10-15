import { describe, it, expect } from "vitest";
import type { Permutation } from "@shared/mathUtils/groups/permutations";
import { PermutationBuffer } from "./permutationBuffer";
import { PermuteNodes, type Permutable } from "./permuteNodes";

/** Three points: 1 and 2 a hundred apart on a line, 3 off it. */
const fakeScene = (palette: Permutation[] = []) => {
  const permuted: Permutation[] = [];
  const scene: Permutable = {
    diagram: {
      points: [
        { point: 1, x: 0, y: 0 },
        { point: 2, x: 100, y: 0 },
        { point: 3, x: 50, y: 80 },
      ],
      rings: [],
      width: 200,
      height: 200,
    },
    palette,
    permute: (permutation) => {
      permuted.push(permutation);
    },
  };
  return { scene, permuted };
};
/** 1 → 2 → 3 → 1. */
const cycle: Permutation = [2, 3, 1];
/** 1 ↔ 2, 3 fixed. */
const swap: Permutation = [2, 1, 3];
const straight = { arrowCurvature: 0, arrowBowWidth: "constant" } as const;
const bowed = { arrowCurvature: 1, arrowBowWidth: "constant" } as const;
const setup = (...queued: Permutation[]) => {
  const buffer = new PermutationBuffer();
  for (const permutation of queued) buffer.push(permutation);
  return new PermuteNodes(buffer);
};
const at = (points: { point: number; x: number; y: number }[], point: number) =>
  points.find((p) => p.point === point);

describe("PermuteNodes", () => {
  it("is idle with nothing queued, and leaves the layout alone", () => {
    const nodes = setup();
    const { scene, permuted } = fakeScene();
    expect(nodes.busy).toBe(false);
    nodes.advance(scene, 1, 1);
    expect(permuted).toEqual([]);
    expect(nodes.points(scene, straight)).toEqual(scene.diagram.points);
  });

  it("is busy as soon as something is queued", () => {
    expect(setup(cycle).busy).toBe(true);
  });

  it("moves each point linearly in time along its way to its image", () => {
    const nodes = setup(cycle);
    const { scene } = fakeScene();
    nodes.advance(scene, 0.25, 1);
    const points = nodes.points(scene, straight);
    expect(at(points, 1)).toEqual({ point: 1, x: 25, y: 0 });
    expect(at(points, 3)?.x).toBeCloseTo(37.5);
    expect(at(points, 3)?.y).toBeCloseTo(60);
  });

  it("leaves a fixed point where it is", () => {
    const nodes = setup(swap);
    const { scene } = fakeScene();
    nodes.advance(scene, 0.5, 1);
    expect(at(nodes.points(scene, straight), 3)).toEqual({ point: 3, x: 50, y: 80 });
  });

  it("commits the permutation once it has run its course, and is then idle", () => {
    const nodes = setup(cycle);
    const { scene, permuted } = fakeScene();
    nodes.advance(scene, 0.5, 1);
    expect(permuted).toEqual([]);
    nodes.advance(scene, 0.5, 1);
    expect(permuted).toEqual([cycle]);
    expect(nodes.busy).toBe(false);
    expect(nodes.points(scene, straight)).toEqual(scene.diagram.points);
  });

  it("runs as many permutations a second as the speed says", () => {
    const nodes = setup(cycle);
    const { scene, permuted } = fakeScene();
    nodes.advance(scene, 0.25, 4);
    expect(permuted).toEqual([cycle]);
  });

  it("takes up the next permutation queued after one finishes", () => {
    const nodes = setup(cycle, swap);
    const { scene, permuted } = fakeScene();
    nodes.advance(scene, 1, 1);
    expect(nodes.busy).toBe(true);
    nodes.advance(scene, 0.5, 1);
    expect(at(nodes.points(scene, straight), 1)).toEqual({ point: 1, x: 50, y: 0 });
    nodes.advance(scene, 0.5, 1);
    expect(permuted).toEqual([cycle, swap]);
  });

  it("rides its own arrow, fanned out with the arrows sharing its path", () => {
    // Drawn after swap, the cycle's arrow 1 → 2 is second on that path.
    const nodes = setup(cycle);
    const { scene } = fakeScene([swap, cycle]);
    nodes.advance(scene, 0.5, 1);
    expect(at(nodes.points(scene, bowed), 1)?.y).toBeCloseTo(12 * 1.35);
  });

  it("rides the bare curve when its generator is not drawn", () => {
    const nodes = setup(cycle);
    const { scene } = fakeScene();
    nodes.advance(scene, 0.5, 1);
    expect(at(nodes.points(scene, bowed), 1)?.y).toBeCloseTo(12);
  });

  it("finishes the running permutation at once, dropping the rest", () => {
    const nodes = setup(cycle, swap);
    const { scene, permuted } = fakeScene();
    nodes.advance(scene, 0.1, 1);
    nodes.finish(scene);
    expect(permuted).toEqual([cycle]);
    expect(nodes.busy).toBe(false);
  });

  it("finishing with nothing running commits nothing, and empties the queue", () => {
    const nodes = setup(cycle);
    const { scene, permuted } = fakeScene();
    nodes.finish(scene);
    expect(permuted).toEqual([]);
    expect(nodes.busy).toBe(false);
  });

  it("drops everything without committing", () => {
    const nodes = setup(cycle, swap);
    const { scene, permuted } = fakeScene();
    nodes.advance(scene, 0.5, 1);
    nodes.drop();
    expect(permuted).toEqual([]);
    expect(nodes.busy).toBe(false);
    expect(nodes.points(scene, straight)).toEqual(scene.diagram.points);
  });
});
