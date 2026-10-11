import {
  composePermutations,
  invertPermutation,
  permutationCycles,
  type Permutation,
} from "../src/shared/mathUtils/groups/permutations.ts";
import type {
  CatalogueRepresentation,
  CatalogueSubgroupClass,
} from "../src/generatorVisualizer/groupCatalogue/catalogue.ts";

/**
 * A renaming of the points that numbers them in the order `perm` walks them:
 * each cycle in turn from its smallest unplaced point, then the fixed points.
 * `result[i]` is the new name of the point `i + 1`, so `perm` renamed by it
 * reads (1 2 … k)(k+1 …)….
 */
export const cycleRelabeling = (perm: Permutation): Permutation => {
  const walked = permutationCycles(perm).flat();
  const placed = new Set(walked);
  const order = [...walked, ...perm.map((_, i) => i + 1).filter((point) => !placed.has(point))];
  const relabeling = new Array<number>(perm.length);
  order.forEach((point, i) => {
    relabeling[point - 1] = i + 1;
  });
  return relabeling;
};

/**
 * The representation with its points renamed so that the generator of the
 * class the page opens on walks them in order.
 *
 * LMFDB numbers the points of a representation to suit its own block
 * structure, which usually leaves the smallest subgroups reading in order and
 * the class the page opens on — the last cyclic one, as `Scene.open` picks it —
 * jumping around its rings. Renaming points is conjugation, so the group, its
 * lattice and the match to LMFDB's classes are all untouched.
 */
export const relabelAlongOpeningClass = (
  representation: CatalogueRepresentation,
  classes: readonly CatalogueSubgroupClass[],
): CatalogueRepresentation => {
  const opening = classes.reduce((last, c, i) => (c.cyclic && c.order > 1 ? i : last), -1);
  if (opening === -1) return representation;
  const [generator] = representation.classGenerators[opening];
  const relabeling = cycleRelabeling(generator);
  const inverse = invertPermutation(relabeling);
  const rename = (perm: Permutation): number[] => [
    ...composePermutations(relabeling, composePermutations(perm, inverse)),
  ];
  return {
    ...representation,
    generators: representation.generators.map(rename),
    classGenerators: representation.classGenerators.map((gens) => gens.map(rename)),
  };
};
