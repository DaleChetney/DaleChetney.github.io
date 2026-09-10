import { describe, it, expect } from "vitest";
import { generatorElements } from "@shared/mathUtils/groups/generatorChoices";
import { decodePermutation, permutationOrder } from "@shared/mathUtils/groups/permutations";
import { computeSubgroupLattice } from "@shared/mathUtils/groups/subgroupLattice";
import { generatesWholeGroup } from "@shared/mathUtils/groups/subgroups";

const C3_C4_GENERATORS = [129, 16, 840].map((code) => decodePermutation(code, 7));
const lattice = computeSubgroupLattice(C3_C4_GENERATORS, 7);
const byOrder = (order: number) => {
  const found = lattice.classes.find((c) => c.order === order);
  if (found === undefined) throw new Error(`no class of order ${order}`);
  return found;
};

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
