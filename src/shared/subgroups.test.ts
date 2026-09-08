import { describe, it, expect } from "vitest";
import { decodePermutation, permutationOrder } from "@shared/permutations";
import {
  computeSubgroupLattice,
  generatesWholeGroup,
  generatorElements,
  primeDivisorCount,
} from "@shared/subgroups";

const C3_C4_GENERATORS = [129, 16, 840].map((code) => decodePermutation(code, 7));
const lattice = computeSubgroupLattice(C3_C4_GENERATORS, 7);
const byOrder = (order: number) => {
  const found = lattice.classes.find((c) => c.order === order);
  if (found === undefined) throw new Error(`no class of order ${order}`);
  return found;
};

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

describe("primeDivisorCount", () => {
  it.each([
    [1, 0],
    [2, 1],
    [3, 1],
    [4, 2],
    [6, 2],
    [12, 3],
    [64, 6],
  ])("counts %i with multiplicity as %i", (n, expected) => {
    expect(primeDivisorCount(n)).toBe(expected);
  });
});

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

describe("generatesWholeGroup", () => {
  const whole = (orders: number[]) =>
    generatesWholeGroup(
      orders.map((order) => byOrder(order).generator ?? []),
      7,
      12,
    );

  it("is false for nothing selected", () => {
    expect(generatesWholeGroup([], 7, 12)).toBe(false);
  });

  it("is true exactly for the pairs that join to the whole group", () => {
    // C_4 with either C_3 or C_6 generates; the central C_2 never does, since it
    // lies inside every subgroup of even order here.
    expect(whole([4, 3])).toBe(true);
    expect(whole([4, 6])).toBe(true);
    expect(whole([4, 2])).toBe(false);
    expect(whole([6, 3])).toBe(false);
    expect(whole([6, 2])).toBe(false);
    expect(whole([3, 2])).toBe(false);
  });

  it("is false for any single proper cyclic subgroup", () => {
    for (const order of [2, 3, 4, 6]) {
      expect(whole([order]), `order ${order}`).toBe(false);
    }
  });
});

describe("generatorElements", () => {
  const c4 = byOrder(4);
  const choices = generatorElements(c4, 12);

  it("lists every element of full order across all conjugates", () => {
    // C_4 has three conjugates with two generators each: six order-4 elements.
    expect(choices.total).toBe(6);
    expect(choices.elements).toHaveLength(6);
    for (const { permutation } of choices.elements) {
      expect(permutationOrder(permutation)).toBe(4);
    }
  });

  it("attributes two elements to each conjugate", () => {
    const perConjugate = new Map<number, number>();
    for (const { conjugate } of choices.elements) {
      perConjugate.set(conjugate, (perConjugate.get(conjugate) ?? 0) + 1);
    }
    expect([...perConjugate.entries()].sort()).toEqual([
      [0, 2],
      [1, 2],
      [2, 2],
    ]);
  });

  it("never lists the same element under two conjugates", () => {
    const keys = choices.elements.map(({ permutation }) => permutation.join(","));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("caps the listing without changing the total", () => {
    const capped = generatorElements(c4, 4);
    expect(capped.elements).toHaveLength(4);
    expect(capped.total).toBe(6);
  });

  it("is stable across calls", () => {
    expect(generatorElements(c4, 12).elements).toEqual(choices.elements);
  });

  it("separates the conjugates that generate the whole group together", () => {
    // Two order-4 elements generate C_3:C_4 exactly when they come from
    // different conjugates; from the same one they only give C_4 back.
    const [first] = choices.elements;
    for (const other of choices.elements.slice(1)) {
      expect(
        generatesWholeGroup([first.permutation, other.permutation], 7, 12),
        `conjugate ${first.conjugate} with ${other.conjugate}`,
      ).toBe(other.conjugate !== first.conjugate);
    }
  });

  it("gives a single generator for a class with one conjugate", () => {
    expect(generatorElements(byOrder(2), 12).total).toBe(1);
    expect(generatorElements(byOrder(3), 12).total).toBe(2);
  });
});
