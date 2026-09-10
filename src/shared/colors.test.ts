import { describe, it, expect } from "vitest";
import chroma from "chroma-js";
import { equidistantColors } from "./colors";

const counts = [1, 2, 3, 5, 8, 12, 24];

describe("equidistantColors", () => {
  it("returns nothing for an empty series", () => {
    expect(equidistantColors(0)).toEqual([]);
  });

  it.each(counts)("returns %i colors", (count) => {
    expect(equidistantColors(count)).toHaveLength(count);
  });

  it.each(counts)("never repeats a color across %i", (count) => {
    expect(new Set(equidistantColors(count)).size).toBe(count);
  });

  it("returns hex strings", () => {
    for (const color of equidistantColors(6)) expect(color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it.each(counts)("spaces %i hues evenly around the wheel", (count) => {
    const hues = equidistantColors(count).map((color) => chroma(color).hcl()[0]);
    const gaps = hues.map((hue, i) => (hue - hues[0] - (360 * i) / count + 540) % 360);
    // Every hue sits on its own spoke, to within 8-bit rounding of the hex.
    for (const gap of gaps) expect(Math.abs(gap - 180)).toBeLessThan(1.5);
  });

  it.each(counts)("holds one lightness across %i colors", (count) => {
    for (const color of equidistantColors(count)) {
      expect(chroma(color).hcl()[2]).toBeCloseTo(55, 0);
    }
  });

  it.each(counts)("keeps every one of %i colors inside sRGB", (count) => {
    // Clipping would move a color off its spoke, which is what the gamut fit avoids.
    for (const color of equidistantColors(count)) {
      expect(chroma(color).clipped()).toBe(false);
    }
  });

  it("keeps a dozen colors perceptibly apart", () => {
    const colors = equidistantColors(12);
    const distances = colors.flatMap((a, i) => colors.slice(i + 1).map((b) => chroma.deltaE(a, b)));
    // A just-noticeable difference is about 2.3; ten is comfortable at a glance.
    expect(Math.min(...distances)).toBeGreaterThan(10);
  });

  it("is stable across calls", () => {
    expect(equidistantColors(5)).toEqual(equidistantColors(5));
  });

  it("gives the same first color whatever the count", () => {
    // The series grows by spreading, not by reassigning from the start.
    const firsts = counts.map((count) => equidistantColors(count)[0]);
    expect(new Set(firsts).size).toBe(1);
  });
});
