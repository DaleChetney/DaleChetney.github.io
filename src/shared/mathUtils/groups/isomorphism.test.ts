import { describe, it, expect } from "vitest";
import { findIsomorphism, minimalGenerators, type GroupIsomorphism } from "./isomorphism";
import {
  composePermutations,
  decodePermutation,
  generatePermutationGroup,
  identityPermutation,
  permutationOrder,
  type Permutation,
} from "./permutations";

const keyOf = (permutation: Permutation): string => permutation.join(",");

/** C_3:C_4 as LMFDB records it: degree 7 minimal faithful, and 12T5 regular. */
const C3_C4_PERM = [129, 16, 840].map((code) => decodePermutation(code, 7));
const C3_C4_REGULAR = [
  [8, 1, 6, 11, 4, 9, 2, 7, 12, 5, 10, 3],
  [5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4],
  [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6],
];

const C4 = [[2, 3, 4, 1]];
const KLEIN = [
  [2, 1, 3, 4],
  [1, 2, 4, 3],
];
const S3 = [
  [2, 3, 1],
  [2, 1, 3],
];
const C6 = [[2, 3, 4, 5, 6, 1]];

const image = (iso: GroupIsomorphism, permutation: Permutation): Permutation => {
  const found = iso.get(keyOf(permutation));
  if (found === undefined) throw new Error(`${keyOf(permutation)} has no image`);
  return found;
};

describe("minimalGenerators", () => {
  it("drops a generator that the others already reach", () => {
    // The square of a 6-cycle adds nothing to the 6-cycle.
    const redundant = [...C6, [3, 4, 5, 6, 1, 2]];
    expect(minimalGenerators(redundant, 6)).toEqual(C6);
  });

  it("keeps enough to generate the whole group", () => {
    const reduced = minimalGenerators(C3_C4_PERM, 7);
    expect(generatePermutationGroup(reduced, 7)).toHaveLength(12);
    expect(reduced.length).toBeLessThan(C3_C4_PERM.length);
  });

  it("leaves an already minimal set alone", () => {
    expect(minimalGenerators(KLEIN, 4)).toHaveLength(2);
  });
});

describe("findIsomorphism", () => {
  const iso = findIsomorphism(C3_C4_PERM, 7, C3_C4_REGULAR, 12);
  const source = generatePermutationGroup(C3_C4_PERM, 7);

  it("finds one between two representations of the same group", () => {
    expect(iso).not.toBeNull();
  });

  it("maps the identity to the identity", () => {
    expect(image(iso!, identityPermutation(7))).toEqual(identityPermutation(12));
  });

  it("maps the source onto the target one to one", () => {
    expect(iso?.size).toBe(12);
    expect(new Set([...(iso?.values() ?? [])].map(keyOf)).size).toBe(12);
  });

  it("is a homomorphism", () => {
    for (const x of source) {
      for (const y of source) {
        expect(image(iso!, composePermutations(x, y))).toEqual(
          composePermutations(image(iso!, x), image(iso!, y)),
        );
      }
    }
  });

  it("keeps every element's order", () => {
    for (const x of source) {
      expect(permutationOrder(image(iso!, x)), keyOf(x)).toBe(permutationOrder(x));
    }
  });

  it("carries a generating set to a generating set", () => {
    // The point of the whole exercise: a selection that generates the group in
    // one representation still generates it in the other.
    const generators = C3_C4_PERM.map((g) => image(iso!, g));
    expect(generatePermutationGroup(generators, 12)).toHaveLength(12);
  });

  it("carries a cyclic subgroup to one of the same order", () => {
    const c4 = generatePermutationGroup([C3_C4_PERM[0]], 7);
    const mapped = generatePermutationGroup([image(iso!, C3_C4_PERM[0])], 12);
    expect(mapped).toHaveLength(c4.length);
  });

  it("refuses two groups of the same order that are not isomorphic", () => {
    expect(findIsomorphism(C4, 4, KLEIN, 4)).toBeNull();
    expect(findIsomorphism(KLEIN, 4, C4, 4)).toBeNull();
    expect(findIsomorphism(S3, 3, C6, 6)).toBeNull();
  });

  it("refuses groups of different orders", () => {
    expect(findIsomorphism(C4, 4, S3, 3)).toBeNull();
  });

  it("maps a group to itself", () => {
    const self = findIsomorphism(C3_C4_PERM, 7, C3_C4_PERM, 7);
    expect(self?.size).toBe(12);
  });

  it("finds one in both directions", () => {
    expect(findIsomorphism(C3_C4_REGULAR, 12, C3_C4_PERM, 7)).not.toBeNull();
  });
});
