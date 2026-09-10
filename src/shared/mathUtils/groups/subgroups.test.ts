import { describe, it, expect } from "vitest";
import { decodePermutation } from "@shared/mathUtils/groups/permutations";
import { computeSubgroupLattice } from "@shared/mathUtils/groups/subgroupLattice";
import { allSubgroups, generatesWholeGroup, subgroupOf } from "@shared/mathUtils/groups/subgroups";
import { generatePermutationGroup } from "@shared/mathUtils/groups/permutations";

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
    const elements = generatePermutationGroup(C3_C4_GENERATORS, 7);
    expect(allSubgroups(elements, 7)).toHaveLength(8);
  });

  it("includes the trivial subgroup and the whole group", () => {
    const elements = generatePermutationGroup(C3_C4_GENERATORS, 7);
    const orders = allSubgroups(elements, 7).map((s) => s.elements.length);
    expect(Math.min(...orders)).toBe(1);
    expect(Math.max(...orders)).toBe(12);
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
