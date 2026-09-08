import { describe, it, expect } from "vitest";
import chroma from "chroma-js";
import { equidistantColours } from "./colours";

const counts = [1, 2, 3, 5, 8, 12, 24];

describe("equidistantColours", () => {
  it("returns nothing for an empty series", () => {
    expect(equidistantColours(0)).toEqual([]);
  });

  it.each(counts)("returns %i colours", (count) => {
    expect(equidistantColours(count)).toHaveLength(count);
  });

  it.each(counts)("never repeats a colour across %i", (count) => {
    expect(new Set(equidistantColours(count)).size).toBe(count);
  });

  it("returns hex strings", () => {
    for (const colour of equidistantColours(6)) expect(colour).toMatch(/^#[0-9a-f]{6}$/);
  });

  it.each(counts)("spaces %i hues evenly around the wheel", (count) => {
    const hues = equidistantColours(count).map((colour) => chroma(colour).hcl()[0]);
    const gaps = hues.map((hue, i) => (hue - hues[0] - (360 * i) / count + 540) % 360);
    // Every hue sits on its own spoke, to within 8-bit rounding of the hex.
    for (const gap of gaps) expect(Math.abs(gap - 180)).toBeLessThan(1.5);
  });

  it.each(counts)("holds one lightness across %i colours", (count) => {
    for (const colour of equidistantColours(count)) {
      expect(chroma(colour).hcl()[2]).toBeCloseTo(55, 0);
    }
  });

  it.each(counts)("keeps every one of %i colours inside sRGB", (count) => {
    // Clipping would move a colour off its spoke, which is what the gamut fit avoids.
    for (const colour of equidistantColours(count)) {
      expect(chroma(colour).clipped()).toBe(false);
    }
  });

  it("keeps a dozen colours perceptibly apart", () => {
    const colours = equidistantColours(12);
    const distances = colours.flatMap((a, i) =>
      colours.slice(i + 1).map((b) => chroma.deltaE(a, b)),
    );
    // A just-noticeable difference is about 2.3; ten is comfortable at a glance.
    expect(Math.min(...distances)).toBeGreaterThan(10);
  });

  it("is stable across calls", () => {
    expect(equidistantColours(5)).toEqual(equidistantColours(5));
  });

  it("gives the same first colour whatever the count", () => {
    // The series grows by spreading, not by reassigning from the start.
    const firsts = counts.map((count) => equidistantColours(count)[0]);
    expect(new Set(firsts).size).toBe(1);
  });
});
