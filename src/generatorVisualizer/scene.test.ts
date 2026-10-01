import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { byLabel, parseCatalogue } from "./catalogue";
import { Scene } from "./scene";

const catalogue = parseCatalogue(
  JSON.parse(readFileSync(resolve(import.meta.dirname, "../../public/groups.json"), "utf8")),
);

/** C_3:C_4 on its transitive degree-12 representation: one orbit of 12 points. */
const twelve = (): Scene => {
  const group = byLabel(catalogue).get("12.1");
  const representation = group?.representations.find((rep) => rep.id === "12T5");
  if (group === undefined || representation === undefined) throw new Error("no 12T5");
  return new Scene(group, representation, 640);
};

/** Where the scene places each point. */
const positions = (scene: Scene): Map<number, string> =>
  new Map(scene.diagram.points.map((p) => [p.point, `${p.x.toFixed(6)},${p.y.toFixed(6)}`]));

/** The points whose place differs between two layouts. */
const moved = (before: Map<number, string>, after: Map<number, string>): number[] =>
  [...after].filter(([point, at]) => before.get(point) !== at).map(([point]) => point);

describe("Scene rings", () => {
  it("finds the ring a point is on, with the rest of that ring", () => {
    const scene = twelve();
    scene.stepRings(0, 1);
    const [outer, inner] = scene.diagram.rings;
    const point = inner.points[2];
    expect(scene.ringOf(point)).toEqual(inner);
    expect(scene.ringOf(outer.points[0])?.ring).toBe(0);
  });

  it("finds nothing for a point not drawn", () => {
    expect(twelve().ringOf(99)).toBeUndefined();
  });

  it("turns one ring alone, leaving the orbit's others in place", () => {
    const scene = twelve();
    scene.stepRings(0, 1);
    scene.stepRings(0, 1);
    const before = positions(scene);
    scene.turnRing(0, 1, 0.1);
    const middle = scene.diagram.rings[1].points;
    expect(moved(before, positions(scene)).sort((a, b) => a - b)).toEqual(
      [...middle].sort((a, b) => a - b),
    );
  });

  it("can turn an orbit drawn as a single ring", () => {
    const scene = twelve();
    const before = positions(scene);
    scene.turnRing(0, 0, 0.25);
    expect(moved(before, positions(scene))).toHaveLength(12);
  });

  it("keeps a ring's turn through a resize", () => {
    const scene = twelve();
    scene.turnRing(0, 0, 0.25);
    scene.relayout(900);
    const turned = positions(scene);
    const fresh = twelve();
    fresh.relayout(900);
    expect(moved(positions(fresh), turned)).toHaveLength(12);
  });

  it("starts the new rings unturned when the orbit is split again", () => {
    const scene = twelve();
    scene.stepRings(0, 1);
    scene.turnRing(0, 0, 0.2);
    scene.stepRings(0, 1);
    const fresh = twelve();
    fresh.stepRings(0, 1);
    fresh.stepRings(0, 1);
    expect(positions(scene)).toEqual(positions(fresh));
  });

  it("turns every ring of a playing orbit at its own rate", () => {
    const scene = twelve();
    scene.stepRings(0, 1);
    scene.togglePlay(0);
    const before = positions(scene);
    scene.turnBy(0.1);
    expect(moved(before, positions(scene))).toHaveLength(12);
  });
});

describe("Scene held ring", () => {
  it("passes a held ring by while its orbit plays, turning the rest", () => {
    const scene = twelve();
    scene.stepRings(0, 1);
    scene.togglePlay(0);
    const [outer, inner] = scene.diagram.rings;
    expect(scene.grabRing(inner.points[0])).toEqual(inner);
    const before = positions(scene);
    scene.turnBy(0.1);
    expect(moved(before, positions(scene)).sort((a, b) => a - b)).toEqual(
      [...outer.points].sort((a, b) => a - b),
    );
  });

  it("carries on playing a ring once it is let go", () => {
    const scene = twelve();
    scene.stepRings(0, 1);
    scene.togglePlay(0);
    scene.grabRing(scene.diagram.rings[1].points[0]);
    scene.letGoRing();
    const before = positions(scene);
    scene.turnBy(0.1);
    expect(moved(before, positions(scene))).toHaveLength(12);
  });

  it("holds nothing for a point not drawn", () => {
    expect(twelve().grabRing(99)).toBeUndefined();
  });
});

describe("Scene lock", () => {
  /** The twelve points split into two rings, with the orbit unlocked. */
  const unlocked = (): Scene => {
    const scene = twelve();
    scene.stepRings(0, 1);
    scene.toggleLock(0);
    return scene;
  };

  it("starts every orbit locked", () => {
    const scene = twelve();
    expect(scene.isLocked(0)).toBe(true);
    expect(scene.ringSplits().map((split) => split.locked)).toEqual([true]);
  });

  it("offers every orbit, including one that cannot be split", () => {
    const group = byLabel(catalogue).get("12.1");
    const representation = group?.representations[0];
    if (group === undefined || representation === undefined) throw new Error("no 12.1");
    const scene = new Scene(group, representation, 640);
    expect(scene.ringSplits().map(({ size, counts }) => [size, counts])).toEqual([
      [3, [1]],
      [4, [1]],
    ]);
  });

  it("plays an orbit drawn as a single ring", () => {
    const scene = twelve();
    scene.togglePlay(0);
    expect(scene.turning).toBe(true);
    const before = positions(scene);
    scene.turnBy(0.1);
    expect(moved(before, positions(scene))).toHaveLength(12);
  });

  it("stops an orbit turning when it is unlocked, and will not play it", () => {
    const scene = twelve();
    scene.togglePlay(0);
    scene.toggleLock(0);
    expect(scene.turning).toBe(false);
    scene.togglePlay(0);
    expect(scene.turning).toBe(false);
  });

  it("moves an unlocked node anywhere, alone", () => {
    const scene = unlocked();
    const before = positions(scene);
    scene.movePoint(1, { x: 100, y: 90 });
    expect(scene.pointAt(1)).toEqual({ x: 100, y: 90 });
    expect(moved(before, positions(scene))).toEqual([1]);
  });

  it("leaves a locked node on its ring", () => {
    const scene = twelve();
    const before = positions(scene);
    scene.movePoint(1, { x: 100, y: 90 });
    expect(positions(scene)).toEqual(before);
  });

  it("keeps a dragged node on the canvas", () => {
    const scene = unlocked();
    scene.movePoint(1, { x: -500, y: 1e6 });
    const at = scene.pointAt(1);
    expect(at?.x).toBeGreaterThan(0);
    expect(at?.y).toBeLessThan(scene.diagram.height);
  });

  it("carries a dragged node with its orbit's centre through a resize", () => {
    const scene = unlocked();
    const centre = (): { cx: number; cy: number } => scene.diagram.rings[0];
    scene.movePoint(1, { x: centre().cx + 30, y: centre().cy - 20 });
    scene.relayout(900);
    expect(scene.pointAt(1)?.x).toBeCloseTo(centre().cx + 30);
    expect(scene.pointAt(1)?.y).toBeCloseTo(centre().cy - 20);
  });

  it("swaps a dragged node's place along with its slot", () => {
    const scene = unlocked();
    scene.movePoint(1, { x: 100, y: 90 });
    const other = scene.pointAt(2);
    scene.pickPoint(1);
    scene.pickPoint(2);
    expect(scene.pointAt(2)).toEqual({ x: 100, y: 90 });
    expect(scene.pointAt(1)).toEqual(other);
  });

  it("sends every node back to its ring, unturned, when locked again", () => {
    const scene = twelve();
    scene.stepRings(0, 1);
    const home = positions(scene);
    scene.turnRing(0, 1, 0.2);
    scene.toggleLock(0);
    scene.movePoint(1, { x: 100, y: 90 });
    scene.toggleLock(0);
    expect(scene.isLocked(0)).toBe(true);
    expect(positions(scene)).toEqual(home);
  });

  it("puts dragged nodes back on the rings when the orbit is split again", () => {
    const scene = unlocked();
    scene.movePoint(1, { x: 100, y: 90 });
    scene.stepRings(0, 1);
    const fresh = twelve();
    fresh.stepRings(0, 1);
    fresh.stepRings(0, 1);
    expect(positions(scene)).toEqual(positions(fresh));
    expect(scene.isLocked(0)).toBe(false);
  });
});
