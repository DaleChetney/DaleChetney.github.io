import { describe, it, expect } from "vitest";
import { decodePermutation } from "@shared/mathUtils/groups/permutations";
import { computeSubgroupLattice } from "@shared/mathUtils/groups/subgroupLattice";
import {
  allSubgroups,
  conjugate,
  conjugatesOf,
  generatesWholeGroup,
  identityKey,
  joinSubgroups,
  meetSubgroups,
  minimalGeneratingSet,
  subgroupClasses,
  subgroupOf,
} from "@shared/mathUtils/groups/subgroups";

const C3_C4_GENERATORS = [129, 16, 840].map((code) => decodePermutation(code, 7));
const lattice = computeSubgroupLattice(C3_C4_GENERATORS, 7);
const byOrder = (order: number) => {
  const found = lattice.classes.find((c) => c.order === order);
  if (found === undefined) throw new Error(`no class of order ${order}`);
  return found;
};

describe("allSubgroups", () => {
  it("finds every subgroup of C_3:C_4, not just one per class", () => {
    // Six classes, with C_4 having three conjugates: eight subgroups in all.
    expect(allSubgroups(C3_C4_GENERATORS, 7)).toHaveLength(8);
  });

  it("includes the trivial subgroup and the whole group", () => {
    const orders = allSubgroups(C3_C4_GENERATORS, 7).map((s) => s.elements.length);
    expect(Math.min(...orders)).toBe(1);
    expect(Math.max(...orders)).toBe(12);
  });
});

describe("subgroupClasses", () => {
  it("groups the eight subgroups of C_3:C_4 into six classes, C_4 having three", () => {
    const classes = subgroupClasses(C3_C4_GENERATORS, 7);
    expect(classes).toHaveLength(6);
    expect(classes.map((c) => c.length).sort()).toEqual([1, 1, 1, 1, 1, 3]);
  });
});

describe("subgroupOf", () => {
  it("closes a single element into its cyclic subgroup", () => {
    const c4 = byOrder(4).generator ?? [];
    expect(subgroupOf([c4], 7).elements).toHaveLength(4);
  });

  it("keys every element it holds", () => {
    const subgroup = subgroupOf(C3_C4_GENERATORS, 7);
    expect(subgroup.keys.size).toBe(subgroup.elements.length);
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

// S_3 on three points: the transpositions and the 3-cycle.
const S3 = [
  [2, 1, 3],
  [2, 3, 1],
];
const swap12 = subgroupOf([[2, 1, 3]], 3);
const swap13 = subgroupOf([[3, 2, 1]], 3);
const swap23 = subgroupOf([[1, 3, 2]], 3);
const rotate = subgroupOf([[2, 3, 1]], 3);

describe("generators", () => {
  it("are kept by subgroupOf and carried through conjugation", () => {
    expect(swap12.generators).toEqual([[2, 1, 3]]);
    const image = conjugate(swap12, [2, 3, 1]);
    expect(image.generators).toEqual([[1, 3, 2]]);
    expect(image.keys.has("1,3,2")).toBe(true);
  });
});

describe("joinSubgroups", () => {
  it("joins a transposition and the 3-cycle into S_3", () => {
    expect(joinSubgroups(swap12, rotate, 3).elements).toHaveLength(6);
  });

  it("closes over the generators of both, not every element", () => {
    expect(joinSubgroups(swap12, rotate, 3).generators).toEqual([
      [2, 1, 3],
      [2, 3, 1],
    ]);
  });
});

describe("meetSubgroups", () => {
  it("meets two different transpositions in the trivial subgroup", () => {
    const meet = meetSubgroups(swap12, swap13, 3);
    expect(meet.elements).toEqual([[1, 2, 3]]);
    expect(meet.generators).toEqual([]);
  });

  it("meets a subgroup with the whole group in itself", () => {
    const meet = meetSubgroups(rotate, subgroupOf(S3, 3), 3);
    expect(identityKey(meet)).toBe(identityKey(rotate));
    expect(subgroupOf(meet.generators, 3).elements).toHaveLength(3);
  });
});

describe("conjugatesOf", () => {
  it("finds the three conjugate transposition subgroups of S_3", () => {
    const orbit = conjugatesOf(swap12, S3);
    expect(orbit.map(identityKey).sort()).toEqual([swap12, swap13, swap23].map(identityKey).sort());
  });

  it("leaves a normal subgroup alone", () => {
    expect(conjugatesOf(rotate, S3)).toHaveLength(1);
  });
});

describe("minimalGeneratingSet", () => {
  it("is empty for the trivial subgroup", () => {
    expect(minimalGeneratingSet(subgroupOf([], 3), 3)).toEqual([]);
  });

  it("is one element for a cyclic subgroup", () => {
    expect(minimalGeneratingSet(rotate, 3)).toEqual([[2, 3, 1]]);
  });

  it("is two elements for S_3, and they generate it", () => {
    const generators = minimalGeneratingSet(subgroupOf(S3, 3), 3);
    expect(generators).toHaveLength(2);
    expect(subgroupOf(generators, 3).elements).toHaveLength(6);
  });
});
