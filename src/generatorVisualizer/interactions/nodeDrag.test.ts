import { describe, it, expect } from "vitest";
import { NodeDrag } from "./nodeDrag";

describe("NodeDrag", () => {
  it("moves the node as far as the pointer moves", () => {
    const drag = new NodeDrag({ x: 100, y: 50 }, { x: 100, y: 50 });
    expect(drag.moveTo({ x: 130, y: 10 })).toEqual({ x: 130, y: 10 });
  });

  it("keeps the pointer on the spot of the node it grabbed", () => {
    const drag = new NodeDrag({ x: 100, y: 50 }, { x: 108, y: 44 });
    expect(drag.moveTo({ x: 108, y: 44 })).toEqual({ x: 100, y: 50 });
    expect(drag.moveTo({ x: 0, y: 0 })).toEqual({ x: -8, y: 6 });
  });
});
