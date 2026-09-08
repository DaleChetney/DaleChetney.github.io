import { describe, it, expect } from "vitest";
import {
  composePermutations,
  decodePermutation,
  formatPermutation,
  generatePermutationGroup,
  identityPermutation,
  permutationCycles,
  permutationFromCycles,
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

  it("rejects an index that is not a whole number", () => {
    expect(() => decodePermutation(1.5, 4)).toThrow(RangeError);
    expect(() => decodePermutation("twelve", 4)).toThrow(RangeError);
    expect(() => decodePermutation("", 4)).toThrow(RangeError);
  });
});

// A code is an index into `degree!`, which passes Number.MAX_SAFE_INTEGER at
// degree 19 — so every group whose representation needs more than 18 points
// arrives as a number a double cannot hold.
describe("decodePermutation beyond a double", () => {
  const factorial = (n: number): bigint => {
    let result = 1n;
    for (let i = 2n; i <= BigInt(n); i++) result *= i;
    return result;
  };

  it("takes the index as a bigint or a decimal string", () => {
    expect(decodePermutation(23n, 4)).toEqual([4, 3, 2, 1]);
    expect(decodePermutation("23", 4)).toEqual([4, 3, 2, 1]);
  });

  it("decodes the last index of a degree past the safe range", () => {
    // 21! - 1 is the reversal, and 21! is about 5.1e19.
    const last = (factorial(21) - 1n).toString();
    expect(decodePermutation(last, 21)).toEqual(Array.from({ length: 21 }, (_, i) => 21 - i));
  });

  it("still bounds the index at degree!", () => {
    expect(() => decodePermutation(factorial(21).toString(), 21)).toThrow(RangeError);
  });

  it("separates two indices a double would collapse together", () => {
    // Both round to the same double, so a number-based decoder cannot tell them
    // apart; as bigints they differ in the last transposition.
    const base = factorial(20);
    const [a, b] = [base + 1n, base + 2n].map((code) => decodePermutation(code.toString(), 21));
    expect(Number(base + 1n)).toBe(Number(base + 2n));
    expect(a).not.toEqual(b);
  });

  // Verbatim `representations.Perm.gens` from LMFDB, at the 32-point ceiling
  // our bounds allow. These codes are 36 digits long.
  it.each([
    {
      label: "32.1",
      name: "C_32",
      codes: [
        "263121961682809333227690318495744000",
        "127165970120440293996769393998336000",
        "59187974339659933956082255161332976",
        "25199055155429228508133415361942982",
        "8231691320578226211046411712681647",
      ],
      order: 32,
      largestElementOrder: 32,
    },
    {
      label: "32.20",
      name: "Q_32",
      codes: [
        "144187682882947265441986938703872000",
        "76209687101520605238972892335527736",
        "50973977447395947166374977137321656",
        "25199055155403427461045987627105862",
        "8231691320578226211046411712681647",
      ],
      order: 32,
      largestElementOrder: 16,
    },
  ])("reproduces LMFDB $label ($name) at degree 32", ({ codes, order, largestElementOrder }) => {
    const generators = codes.map((code) => decodePermutation(code, 32));
    const elements = generatePermutationGroup(generators, 32);
    expect(elements).toHaveLength(order);
    // C_32 is cyclic and Q_32 is not, which the largest element order separates.
    expect(Math.max(...elements.map(permutationOrder))).toBe(largestElementOrder);
  });
});

// The encoding is not documented alongside the data, so these cases pin it
// against groups whose structure is independently known. Each generator set is
// the verbatim `representations.Perm.gens` array from LMFDB.
describe("decodePermutation against LMFDB", () => {
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

describe("permutationFromCycles", () => {
  it("fixes every point when there are no cycles", () => {
    expect(permutationFromCycles([], 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("fixes the points no cycle mentions", () => {
    expect(permutationFromCycles([[2, 3]], 4)).toEqual([1, 3, 2, 4]);
  });

  it("sends the last point of a cycle back to the first", () => {
    expect(permutationFromCycles([[1, 2, 3]], 3)).toEqual([2, 3, 1]);
  });

  it("takes a fixed point written as a cycle of one", () => {
    expect(permutationFromCycles([[1], [2, 3]], 3)).toEqual([1, 3, 2]);
  });

  it("rejects a point outside the degree", () => {
    expect(() => permutationFromCycles([[1, 5]], 4)).toThrow(RangeError);
    expect(() => permutationFromCycles([[0, 1]], 4)).toThrow(RangeError);
  });

  it("rejects a point used twice", () => {
    expect(() =>
      permutationFromCycles(
        [
          [1, 2],
          [2, 3],
        ],
        4,
      ),
    ).toThrow(RangeError);
    expect(() => permutationFromCycles([[1, 2, 1]], 4)).toThrow(RangeError);
  });

  it("inverts permutationCycles", () => {
    const perm = [8, 1, 6, 11, 4, 9, 2, 7, 12, 5, 10, 3];
    expect(permutationFromCycles(permutationCycles(perm), 12)).toEqual(perm);
  });

  // gps_transitive stores generators as cycles, so this is the shape a
  // transitive representation actually arrives in. 12T5 is C_3:C_4 acting
  // regularly, and this generator is the one already baked in one-line form.
  it("reads LMFDB 12T5's first generator", () => {
    expect(
      permutationFromCycles(
        [
          [1, 8, 7, 2],
          [3, 6, 9, 12],
          [4, 11, 10, 5],
        ],
        12,
      ),
    ).toEqual([8, 1, 6, 11, 4, 9, 2, 7, 12, 5, 10, 3]);
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
