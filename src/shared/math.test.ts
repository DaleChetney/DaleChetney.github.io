import { describe, it, expect } from "vitest";
import { clamp, lerp, mod, hexDistance, hexToPixel } from "@shared/math";

describe("clamp", () => {
  it("returns the value when within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it("clamps to the bounds", () => {
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});

describe("lerp", () => {
  it("interpolates linearly", () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 1)).toBe(10);
  });
});

describe("mod", () => {
  it("is always non-negative", () => {
    expect(mod(-1, 4)).toBe(3);
    expect(mod(5, 4)).toBe(1);
  });
});

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
