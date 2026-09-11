import { describe, it, expect } from "vitest";
import { matchSubgroupClasses, type ClassShape } from "./matchSubgroupClasses.ts";

const s3: ClassShape[] = [
  { order: 1, count: 1, cyclic: true, covers: [] },
  { order: 2, count: 3, cyclic: true, covers: [0] },
  { order: 3, count: 1, cyclic: true, covers: [0] },
  { order: 6, count: 1, cyclic: false, covers: [1, 2] },
];

/** The same lattice with its classes listed in reverse. */
const reversed = (classes: readonly ClassShape[]): ClassShape[] => {
  const last = classes.length - 1;
  return [...classes].reverse().map((c) => ({ ...c, covers: c.covers.map((i) => last - i) }));
};

describe("matchSubgroupClasses", () => {
  it("matches identical lattices by identity", () => {
    expect(matchSubgroupClasses(s3, s3)).toEqual([0, 1, 2, 3]);
  });

  it("matches a lattice listed in another order", () => {
    expect(matchSubgroupClasses(s3, reversed(s3))).toEqual([3, 2, 1, 0]);
  });

  it("assigns automorphic duplicates so the covers still agree", () => {
    // C_2 x C_2: three normal C_2s that nothing distinguishes.
    const v4: ClassShape[] = [
      { order: 1, count: 1, cyclic: true, covers: [] },
      { order: 2, count: 1, cyclic: true, covers: [0] },
      { order: 2, count: 1, cyclic: true, covers: [0] },
      { order: 2, count: 1, cyclic: true, covers: [0] },
      { order: 4, count: 1, cyclic: false, covers: [1, 2, 3] },
    ];
    const matching = matchSubgroupClasses(v4, reversed(v4));
    expect([...matching].sort()).toEqual([0, 1, 2, 3, 4]);
    expect(matching[0]).toBe(4);
    expect(matching[4]).toBe(0);
  });

  it("tells apart classes that only what lies above them distinguishes", () => {
    // Two normal C_2s of which only one lies under the C_4.
    const g: ClassShape[] = [
      { order: 1, count: 1, cyclic: true, covers: [] },
      { order: 2, count: 1, cyclic: true, covers: [0] },
      { order: 2, count: 1, cyclic: true, covers: [0] },
      { order: 4, count: 1, cyclic: true, covers: [1] },
      { order: 8, count: 1, cyclic: false, covers: [2, 3] },
    ];
    const swapped: ClassShape[] = [
      g[0],
      g[2],
      g[1],
      { ...g[3], covers: [2] },
      { ...g[4], covers: [1, 3] },
    ];
    expect(matchSubgroupClasses(g, swapped)).toEqual([0, 2, 1, 3, 4]);
  });

  it("keeps the covers consistent when several duplicates are nested", () => {
    // C_2 x C_2 x C_2: seven C_2s, seven V_4s, each V_4 over three C_2s. Any
    // matching must send the three C_2s under a V_4 to the three under its image.
    const points = [1, 2, 3, 4, 5, 6, 7];
    const planes = [
      [1, 2, 3],
      [1, 4, 5],
      [1, 6, 7],
      [2, 4, 6],
      [2, 5, 7],
      [3, 4, 7],
      [3, 5, 6],
    ];
    const fano: ClassShape[] = [
      { order: 1, count: 1, cyclic: true, covers: [] },
      ...points.map((): ClassShape => ({ order: 2, count: 1, cyclic: true, covers: [0] })),
      ...planes.map((plane): ClassShape => ({ order: 4, count: 1, cyclic: false, covers: plane })),
      { order: 8, count: 1, cyclic: false, covers: [8, 9, 10, 11, 12, 13, 14] },
    ];
    const target = reversed(fano);
    const matching = matchSubgroupClasses(fano, target);
    fano.forEach((c, i) => {
      const image = target[matching[i]];
      expect([...image.covers].sort()).toEqual(c.covers.map((j) => matching[j]).sort());
    });
  });

  it("throws when the class counts differ", () => {
    expect(() => matchSubgroupClasses(s3, s3.slice(0, 3))).toThrow(/4 classes.*3/);
  });

  it("throws when the invariants differ", () => {
    const wrong = s3.map((c, i) => (i === 1 ? { ...c, count: 1 } : c));
    expect(() => matchSubgroupClasses(s3, wrong)).toThrow(/signature/);
  });

  it("throws when the covers cannot be reconciled", () => {
    // Same invariants and same signatures, but C_4 sits over the other C_2 and
    // the whole covers only C_2s of one kind: no bijection preserves the covers.
    const a: ClassShape[] = [
      { order: 1, count: 1, cyclic: true, covers: [] },
      { order: 2, count: 1, cyclic: true, covers: [0] },
      { order: 2, count: 1, cyclic: true, covers: [0] },
      { order: 4, count: 1, cyclic: true, covers: [1] },
      { order: 4, count: 1, cyclic: true, covers: [2] },
      { order: 8, count: 1, cyclic: false, covers: [3, 4] },
    ];
    const b: ClassShape[] = [
      a[0],
      a[1],
      a[2],
      { ...a[3], covers: [1] },
      { ...a[4], covers: [1] },
      a[5],
    ];
    expect(() => matchSubgroupClasses(a, b)).toThrow(/signature|covers/);
  });
});
