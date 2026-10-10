import { describe, it, expect } from "vitest";
import { angleAbout, RingDrag, toDiagram, turnBetween } from "./ringDrag";

const center = { x: 100, y: 100 };
/** A point `turns` clockwise round the centre from the right, at radius 50. */
const around = (turns: number) => ({
  x: center.x + 50 * Math.cos(2 * Math.PI * turns),
  y: center.y + 50 * Math.sin(2 * Math.PI * turns),
});

describe("toDiagram", () => {
  const screen = (m: Partial<DOMMatrix> | null) => ({
    getScreenCTM: () =>
      m === null ? null : ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, ...m } as DOMMatrix),
  });

  it("undoes the offset the SVG is drawn at", () => {
    expect(toDiagram(screen({ e: 30, f: 40 }), 130, 90)).toEqual({ x: 100, y: 50 });
  });

  it("undoes the scale the SVG is drawn at", () => {
    expect(toDiagram(screen({ a: 2, d: 2, e: 10, f: 10 }), 210, 110)).toEqual({ x: 100, y: 50 });
  });

  it("undoes a rotation", () => {
    // A quarter turn: diagram (1, 0) lands on screen (0, 1).
    const at = toDiagram(screen({ a: 0, b: 1, c: -1, d: 0 }), 0, 1);
    expect(at?.x).toBeCloseTo(1);
    expect(at?.y).toBeCloseTo(0);
  });

  it("gives nothing while the SVG is not on screen", () => {
    expect(toDiagram(screen(null), 10, 10)).toBeNull();
  });
});

describe("angleAbout", () => {
  it("measures clockwise, as the diagram is drawn with y down", () => {
    expect(angleAbout(center, around(0))).toBeCloseTo(0);
    // Straight below the centre is a quarter turn clockwise from the right.
    expect(angleAbout(center, { x: 100, y: 150 })).toBeCloseTo(0.25);
  });

  it("has no angle at the centre", () => {
    expect(angleAbout(center, { x: 101, y: 100 })).toBeUndefined();
  });
});

describe("turnBetween", () => {
  it("measures clockwise as positive, anticlockwise as negative", () => {
    expect(turnBetween(0.1, 0.2)).toBeCloseTo(0.1);
    expect(turnBetween(0.2, 0.1)).toBeCloseTo(-0.1);
  });

  it("goes the short way across the seam", () => {
    expect(turnBetween(0.45, -0.45)).toBeCloseTo(0.1);
    expect(turnBetween(-0.45, 0.45)).toBeCloseTo(-0.1);
  });
});

describe("RingDrag", () => {
  it("reports each move's turn, and the whole turn so far", () => {
    const drag = new RingDrag(center, around(0));
    expect(drag.moveTo(around(0.1))).toBeCloseTo(0.1);
    expect(drag.moveTo(around(0.05))).toBeCloseTo(-0.05);
    expect(drag.total).toBeCloseTo(0.05);
  });

  it("counts more than a whole turn, round and round", () => {
    const drag = new RingDrag(center, around(0));
    for (let step = 1; step <= 30; step++) drag.moveTo(around(step * 0.05));
    expect(drag.total).toBeCloseTo(1.5);
  });

  it("goes by angle, not distance: a move outward turns nothing", () => {
    const drag = new RingDrag(center, around(0.2));
    expect(
      drag.moveTo({
        x: center.x + 3 * (around(0.2).x - center.x),
        y: center.y + 3 * (around(0.2).y - center.y),
      }),
    ).toBeCloseTo(0);
  });

  it("ignores the centre, picking up again from where the pointer comes out", () => {
    const drag = new RingDrag(center, around(0));
    expect(drag.moveTo(center)).toBe(0);
    expect(drag.moveTo(around(0.1))).toBeCloseTo(0.1);
  });

  it("waits for an angle when the drag starts at the centre", () => {
    const drag = new RingDrag(center, center);
    expect(drag.moveTo(around(0.3))).toBe(0);
    expect(drag.moveTo(around(0.35))).toBeCloseTo(0.05);
  });
});
