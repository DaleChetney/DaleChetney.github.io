import { describe, it, expect } from "vitest";
import { hexDistance, hexToPixel } from "@shared/mathUtils/hex";

describe("hexDistance", () => {
  it("is zero for identical coordinates", () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(0);
  });
  it("counts steps between coordinates", () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 2, r: -1 })).toBe(2);
  });
});

describe("hexToPixel", () => {
  it("places the origin hex at the pixel origin", () => {
    expect(hexToPixel({ q: 0, r: 0 }, 10)).toEqual({ x: 0, y: 0 });
  });
  it("offsets along q by three-halves the size, and half a row down", () => {
    const { x, y } = hexToPixel({ q: 1, r: 0 }, 10);
    expect(x).toBeCloseTo(15, 6);
    expect(y).toBeCloseTo(8.660254, 6);
  });
  it("offsets along r by a full row, with no horizontal shift", () => {
    const { x, y } = hexToPixel({ q: 0, r: 1 }, 10);
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(17.320508, 6);
  });
});
