import { describe, it, expect } from "vitest";
import {
  composePermutations,
  decodePermutation,
  formatPermutation,
  generatePermutationGroup,
  identityPermutation,
  permutationCycles,
  permutationOrbits,
  permutationOrder,
  type Permutation,
} from "@shared/permutations";

/** Count elements by their order, the shape LMFDB stores as `order_stats`. */
const orderStats = (elements: readonly Permutation[]): Record<number, number> => {
  const stats: Record<number, number> = {};
  for (const element of elements) {
    const order = permutationOrder(element);
    stats[order] = (stats[order] ?? 0) + 1;
  }
  return stats;
};

describe("identityPermutation", () => {
  it("fixes every point", () => {
    expect(identityPermutation(4)).toEqual([1, 2, 3, 4]);
  });
});

describe("decodePermutation", () => {
  it("decodes index 0 to the identity", () => {
    expect(decodePermutation(0, 4)).toEqual([1, 2, 3, 4]);
  });

  it("decodes the last index to the reversal", () => {
    expect(decodePermutation(23, 4)).toEqual([4, 3, 2, 1]);
  });

  it("walks the lexicographic ordering", () => {
    const all = Array.from({ length: 6 }, (_, i) => decodePermutation(i, 3));
    expect(all).toEqual([
      [1, 2, 3],
      [1, 3, 2],
      [2, 1, 3],
      [2, 3, 1],
      [3, 1, 2],
      [3, 2, 1],
    ]);
  });

  it("rejects an index outside 0..degree! - 1", () => {
    expect(() => decodePermutation(24, 4)).toThrow(RangeError);
    expect(() => decodePermutation(-1, 4)).toThrow(RangeError);
  });

  // The encoding is not documented alongside the data, so these cases pin it
  // against groups whose structure is independently known. Each generator set
  // is the verbatim `representations.Perm.gens` array from LMFDB.
  it.each([
    { label: "8.3", name: "D_4", codes: [6, 16, 7], degree: 4, order: 8 },
    { label: "12.1", name: "C_3:C_4", codes: [129, 16, 840], degree: 7, order: 12 },
    { label: "12.3", name: "A_4", codes: [4, 16, 7], degree: 4, order: 12 },
    { label: "60.5", name: "A_5", codes: [33, 30], degree: 5, order: 60 },
  ])("reproduces LMFDB $label ($name)", ({ codes, degree, order }) => {
    const generators = codes.map((code) => decodePermutation(code, degree));
    expect(generatePermutationGroup(generators, degree)).toHaveLength(order);
  });

  it("reproduces the order statistics LMFDB records for 12.1", () => {
    const generators = [129, 16, 840].map((code) => decodePermutation(code, 7));
    // LMFDB `gps_groups.order_stats` for 12.1: [[1,1],[2,1],[3,2],[4,6],[6,2]].
    expect(orderStats(generatePermutationGroup(generators, 7))).toEqual({
      1: 1,
      2: 1,
      3: 2,
      4: 6,
      6: 2,
    });
  });
});

describe("composePermutations", () => {
  it("applies the right operand first", () => {
    const a = [2, 1, 3]; // (1 2)
    const b = [1, 3, 2]; // (2 3)
    expect(composePermutations(a, b)).toEqual([2, 3, 1]); // (1 2 3)
  });

  it("is neutral against the identity", () => {
    const p = [3, 1, 2];
    expect(composePermutations(p, identityPermutation(3))).toEqual(p);
    expect(composePermutations(identityPermutation(3), p)).toEqual(p);
  });
});

describe("permutationCycles", () => {
  it("omits fixed points", () => {
    expect(permutationCycles([1, 3, 2, 4])).toEqual([[2, 3]]);
  });

  it("returns nothing for the identity", () => {
    expect(permutationCycles(identityPermutation(5))).toEqual([]);
  });

  it("starts each cycle at its smallest point", () => {
    expect(permutationCycles([2, 3, 1, 6, 4, 5])).toEqual([
      [1, 2, 3],
      [4, 6, 5],
    ]);
  });
});

describe("formatPermutation", () => {
  it("renders the identity as ()", () => {
    expect(formatPermutation(identityPermutation(4))).toBe("()");
  });

  it("renders disjoint cycles", () => {
    expect(formatPermutation([1, 3, 2, 6, 7, 5, 4])).toBe("(2 3)(4 6 5 7)");
  });
});

describe("permutationOrder", () => {
  it("is 1 for the identity", () => {
    expect(permutationOrder(identityPermutation(5))).toBe(1);
  });

  it("is the lcm of the cycle lengths", () => {
    // (1 2)(3 4 5) has order 6.
    expect(permutationOrder([2, 1, 4, 5, 3])).toBe(6);
  });
});

describe("permutationOrbits", () => {
  it("splits the minimal faithful representation of 12.1 into 3 + 4 points", () => {
    const generators = [129, 16, 840].map((code) => decodePermutation(code, 7));
    expect(permutationOrbits(generators, 7)).toEqual([
      [1, 2, 3],
      [4, 5, 6, 7],
    ]);
  });

  it("returns one orbit for a transitive action", () => {
    const generators = [decodePermutation(33, 5), decodePermutation(30, 5)]; // A_5
    expect(permutationOrbits(generators, 5)).toEqual([[1, 2, 3, 4, 5]]);
  });

  it("returns singletons when there are no generators", () => {
    expect(permutationOrbits([], 3)).toEqual([[1], [2], [3]]);
  });
});

describe("generatePermutationGroup", () => {
  it("returns just the identity for no generators", () => {
    expect(generatePermutationGroup([], 4)).toEqual([[1, 2, 3, 4]]);
  });

  it("puts the identity first", () => {
    const elements = generatePermutationGroup([decodePermutation(840, 7)], 7);
    expect(elements[0]).toEqual(identityPermutation(7));
  });

  it("closes a single generator into its cyclic group", () => {
    const fourCycle = [2, 3, 4, 1];
    expect(generatePermutationGroup([fourCycle], 4)).toHaveLength(4);
  });
});
