import { describe, it, expect } from "vitest";
import { classPoset } from "./classPoset";

// S_3's classes: trivial, the transpositions, the 3-cycle, the whole group.
const s3 = classPoset([[], [0], [0], [1, 2]]);

describe("classPoset", () => {
  it("finds the bounds", () => {
    expect(s3.size).toBe(4);
    expect(s3.bottom).toBe(0);
    expect(s3.top).toBe(3);
  });

  it("closes the covers transitively, and strictly", () => {
    expect(s3.below(0, 3)).toBe(true);
    expect(s3.below(1, 3)).toBe(true);
    expect(s3.below(1, 2)).toBe(false);
    expect(s3.below(3, 0)).toBe(false);
    expect(s3.below(1, 1)).toBe(false);
  });

  it("includes the class itself in its down-set and up-set", () => {
    expect([...s3.downSet(3)].sort()).toEqual([0, 1, 2, 3]);
    expect([...s3.downSet(1)].sort()).toEqual([0, 1]);
    expect([...s3.upSet(1)].sort()).toEqual([1, 3]);
    expect([...s3.upSet(0)].sort()).toEqual([0, 1, 2, 3]);
  });

  it("follows chains longer than one cover", () => {
    // C_12's chain 1 < C_2 < C_4 < C_12, plus C_3 and C_6 off to the side.
    const c12 = classPoset([[], [0], [1], [0], [1, 3], [2, 4]]);
    expect(c12.below(0, 5)).toBe(true);
    expect([...c12.downSet(4)].sort()).toEqual([0, 1, 3, 4]);
  });

  it("refuses a poset without a single top or bottom", () => {
    expect(() => classPoset([[], [0], [0]])).toThrow(/top/);
    expect(() => classPoset([[], [], [0, 1]])).toThrow(/bottom/);
    expect(() => classPoset([])).toThrow(/bottom/);
  });
});
