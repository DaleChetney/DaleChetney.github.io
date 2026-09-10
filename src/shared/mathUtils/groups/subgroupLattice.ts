import { primeDivisorCount } from "../math";
import { generatePermutationGroup, permutationOrder, type Permutation } from "./permutations";
import { allSubgroups, conjugate, identityKey, isSubsetOf, type Subgroup } from "./subgroups";

/**
 * A conjugacy class of subgroups. LMFDB stores subgroups at this granularity,
 * and the diagram draws one node per class.
 */
export interface SubgroupClass {
  /** Stable within a lattice: `<order>-<index among classes of that order>`. */
  id: string;
  order: number;
  /** Number of conjugate subgroups in the class. */
  count: number;
  cyclic: boolean;
  /**
   * Number of prime divisors of the order counted with multiplicity. LMFDB's
   * default subgroup diagram uses this, not the order, as the vertical axis.
   */
  level: number;
  /** A generator of `representative`, when the class is cyclic. */
  generator: Permutation | null;
  representative: Subgroup;
  conjugates: readonly Subgroup[];
}

export interface SubgroupLattice {
  classes: SubgroupClass[];
  /** `covers[i]` holds the indices of the classes immediately below class `i`. */
  covers: number[][];
}

/** Partition the subgroups into conjugacy classes, smallest order first. */
const conjugacyClasses = (
  subgroups: readonly Subgroup[],
  elements: readonly Permutation[],
): Subgroup[][] => {
  const seen = new Set<string>();
  const grouped: Subgroup[][] = [];
  for (const subgroup of subgroups) {
    if (seen.has(identityKey(subgroup))) continue;
    const conjugates: Subgroup[] = [];
    const local = new Set<string>();
    for (const element of elements) {
      const image = conjugate(subgroup, element);
      const key = identityKey(image);
      if (local.has(key)) continue;
      local.add(key);
      seen.add(key);
      conjugates.push(image);
    }
    grouped.push(conjugates);
  }
  grouped.sort((a, b) => a[0].elements.length - b[0].elements.length);
  return grouped;
};

/**
 * Cover relations between classes: `covers[i]` holds the classes immediately
 * below class `i`.
 *
 * A class sits below another when some conjugate of the first lies inside some
 * conjugate of the second; covers are that relation's transitive reduction.
 */
const coverRelations = (classes: readonly SubgroupClass[]): number[][] => {
  const below = classes.map((lower) =>
    classes.map(
      (upper) =>
        lower !== upper &&
        lower.conjugates.some((a) => upper.conjugates.some((b) => isSubsetOf(a, b))),
    ),
  );
  return classes.map((_, upper) =>
    classes
      .map((__, lower) => lower)
      .filter(
        (lower) =>
          below[lower][upper] &&
          !classes.some((___, middle) => below[lower][middle] && below[middle][upper]),
      ),
  );
};

/**
 * The lattice of subgroups up to conjugacy, with cover relations, ordered by
 * subgroup order ascending so the trivial subgroup is first and the whole group
 * last.
 */
export const computeSubgroupLattice = (
  generators: readonly Permutation[],
  degree: number,
): SubgroupLattice => {
  const elements = generatePermutationGroup(generators, degree);
  const grouped = conjugacyClasses(allSubgroups(elements, degree), elements);

  const perOrder = new Map<number, number>();
  const classes: SubgroupClass[] = grouped.map((conjugates) => {
    const representative = conjugates[0];
    const order = representative.elements.length;
    const index = perOrder.get(order) ?? 0;
    perOrder.set(order, index + 1);
    const generator =
      representative.elements.find((element) => permutationOrder(element) === order) ?? null;
    return {
      id: `${order}-${index}`,
      order,
      count: conjugates.length,
      cyclic: generator !== null,
      level: primeDivisorCount(order),
      generator,
      representative,
      conjugates,
    };
  });

  return { classes, covers: coverRelations(classes) };
};
