import { describe, it, expect } from "vitest";
import { generatorElements } from "@shared/mathUtils/groups/generatorChoices";
import {
  composePermutations,
  decodePermutation,
  identityPermutation,
  permutationFromCycles,
  permutationKey,
  permutationOrder,
  type Permutation,
} from "@shared/mathUtils/groups/permutations";
import { computeSubgroupLattice } from "@shared/mathUtils/groups/subgroupLattice";
import { generatesWholeGroup, subgroupOf } from "@shared/mathUtils/groups/subgroups";

const C3_C4_GENERATORS = [129, 16, 840].map((code) => decodePermutation(code, 7));
const lattice = computeSubgroupLattice(C3_C4_GENERATORS, 7);
const byOrder = (order: number) => {
  const found = lattice.classes.find((c) => c.order === order);
  if (found === undefined) throw new Error(`no class of order ${order}`);
  return found;
};
/** LMFDB's Aut(Cₙ) exponents for the orders C_3:C_4's cyclic classes have. */
const AUT_EXPONENTS: Record<number, number[]> = { 2: [], 3: [2], 4: [3] };
const choicesOf = (order: number) =>
  generatorElements(order, byOrder(order).conjugates, AUT_EXPONENTS[order]);

const power = (g: Permutation, k: number): Permutation => {
  let result = identityPermutation(g.length);
  for (let i = 0; i < k; i++) result = composePermutations(result, g);
  return result;
};

describe("generatorElements", () => {
  const choices = choicesOf(4);

  it("lists every element of full order across all conjugates", () => {
    // C_4 has three conjugates with two generators each: six order-4 elements.
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

  it("is stable across calls", () => {
    expect(choicesOf(4).elements).toEqual(choices.elements);
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

  it("starts each conjugate from its smallest generator and walks its orbit", () => {
    for (const conjugate of [0, 1, 2]) {
      const [base, other] = choices.elements.filter((choice) => choice.conjugate === conjugate);
      expect(base.exponent).toBe(1);
      expect(other.exponent).toBe(3);
      expect(other.permutation).toEqual(power(base.permutation, 3));
      expect(
        permutationKey(base.permutation).localeCompare(permutationKey(other.permutation)),
      ).toBe(-1);
    }
  });

  it("orders C₁₆'s generators by orbit under its largest automorphism", () => {
    const g = permutationFromCycles([Array.from({ length: 16 }, (_, i) => i + 1)], 16);
    const { elements } = generatorElements(16, [subgroupOf([g], 16)], [15, 3]);
    expect(elements.map((choice) => choice.exponent)).toEqual([1, 3, 9, 11, 15, 13, 7, 5]);
    for (const { permutation, exponent } of elements) {
      expect(permutation, `g^${String(exponent)}`).toEqual(
        power(elements[0].permutation, exponent),
      );
    }
  });

  it("gives a single generator for a class with one conjugate", () => {
    expect(choicesOf(2).elements).toHaveLength(1);
    expect(choicesOf(3).elements).toHaveLength(2);
  });
});
