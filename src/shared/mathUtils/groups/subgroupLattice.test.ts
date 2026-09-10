import { describe, it, expect } from "vitest";
import { decodePermutation, permutationOrder } from "@shared/mathUtils/groups/permutations";
import { computeSubgroupLattice } from "@shared/mathUtils/groups/subgroupLattice";

const C3_C4_GENERATORS = [129, 16, 840].map((code) => decodePermutation(code, 7));
const lattice = computeSubgroupLattice(C3_C4_GENERATORS, 7);

/** Cover edges as `[upperOrder, lowerOrder]`, sorted for comparison. */
const coverEdges = (): [number, number][] =>
  lattice.covers
    .flatMap((lowers, upper) =>
      lowers.map((lower): [number, number] => [
        lattice.classes[upper].order,
        lattice.classes[lower].order,
      ]),
    )
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);

// gps_subgroup_data / gps_subgroup_search for ambient 12.1 record exactly six
// classes, with C_4 the only one having conjugates, and the inclusions below.
describe("computeSubgroupLattice for C_3:C_4", () => {
  it("finds the six classes LMFDB records", () => {
    expect(lattice.classes.map((c) => c.order)).toEqual([1, 2, 3, 4, 6, 12]);
  });

  it("matches LMFDB's conjugate counts", () => {
    expect(lattice.classes.map((c) => c.count)).toEqual([1, 1, 1, 3, 1, 1]);
  });

  it("accounts for all eight subgroups", () => {
    expect(lattice.classes.reduce((total, c) => total + c.count, 0)).toBe(8);
  });

  it("marks every proper subgroup cyclic and the whole group not", () => {
    expect(lattice.classes.map((c) => c.cyclic)).toEqual([true, true, true, true, true, false]);
  });

  it("levels classes by prime divisors with multiplicity", () => {
    expect(lattice.classes.map((c) => c.level)).toEqual([0, 1, 1, 2, 2, 3]);
  });

  it("reproduces LMFDB's inclusions as cover edges", () => {
    expect(coverEdges()).toEqual([
      [2, 1],
      [3, 1],
      [4, 2],
      [6, 2],
      [6, 3],
      [12, 4],
      [12, 6],
    ]);
  });

  it("gives each cyclic class a generator of the right order", () => {
    for (const subgroupClass of lattice.classes) {
      if (subgroupClass.generator === null) continue;
      expect(permutationOrder(subgroupClass.generator), subgroupClass.id).toBe(subgroupClass.order);
    }
  });

  it("gives every conjugate the same order as its representative", () => {
    for (const subgroupClass of lattice.classes) {
      for (const conjugate of subgroupClass.conjugates) {
        expect(conjugate.elements).toHaveLength(subgroupClass.order);
      }
    }
  });
});
