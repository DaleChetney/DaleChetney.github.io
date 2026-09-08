import type { Permutation } from "@shared/permutations";

/**
 * A faithful permutation representation of an abstract group.
 *
 * `generators` are stored as explicit one-line images rather than in LMFDB's
 * integer encoding, so the data reads as what it is. `generatorCodes` keeps the
 * source values where LMFDB recorded them, and `data.test.ts` checks the two
 * against each other via `decodePermutation`.
 */
export interface PermutationRepresentation {
  /** Stable id, used for selection state and the URL fragment. */
  id: string;
  title: string;
  degree: number;
  generators: readonly Permutation[];
  /** LMFDB `representations.Perm.gens`, when this is that representation. */
  generatorCodes?: readonly number[];
  transitive: boolean;
}

export interface AbstractGroup {
  /** LMFDB abstract group label, e.g. `12.1`. */
  label: string;
  /** LMFDB `name`, in plain ASCII. */
  name: string;
  /** LMFDB `tex_name`. */
  texName: string;
  displayName: string;
  order: number;
  representations: readonly PermutationRepresentation[];
}

/**
 * C_3 : C_4, the dicyclic group of order 12.
 * Baked from LMFDB https://www.lmfdb.org/Groups/Abstract/12.1
 */
export const C3_C4: AbstractGroup = {
  label: "12.1",
  name: "C3:C4",
  texName: "C_3:C_4",
  displayName: "C₃ ⋊ C₄",
  order: 12,
  representations: [
    {
      id: "perm-7",
      title: "Minimal faithful — degree 7",
      degree: 7,
      // (2 3)(4 5 6 7), (4 6)(5 7), (1 2 3)
      generators: [
        [1, 3, 2, 5, 6, 7, 4],
        [1, 2, 3, 6, 7, 4, 5],
        [2, 3, 1, 4, 5, 6, 7],
      ],
      generatorCodes: [129, 16, 840],
      transitive: false,
    },
    {
      id: "12T5",
      title: "12T5 — regular, degree 12",
      degree: 12,
      // (1 8 7 2)(3 6 9 12)(4 11 10 5), (1 5 9)(2 6 10)(3 7 11)(4 8 12),
      // (1 7)(2 8)(3 9)(4 10)(5 11)(6 12)
      generators: [
        [8, 1, 6, 11, 4, 9, 2, 7, 12, 5, 10, 3],
        [5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4],
        [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6],
      ],
      transitive: true,
    },
  ],
};
