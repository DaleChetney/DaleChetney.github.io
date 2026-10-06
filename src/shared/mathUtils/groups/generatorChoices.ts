import { orbitsUnder, largestOrbitExponent } from "./autOrbits.ts";
import {
  permutationKey,
  permutationOrder,
  permutationPowers,
  type Permutation,
} from "./permutations.ts";
import type { Subgroup } from "./subgroups.ts";

/** One element that generates a subgroup in a class, and which conjugate it generates. */
export interface GeneratorElement {
  permutation: Permutation;
  /** Index into the class's conjugates. */
  conjugate: number;
  /** The power of its conjugate's first generator this element is. */
  exponent: number;
}

export interface GeneratorChoices {
  elements: GeneratorElement[];
}

/**
 * The elements that generate the subgroups in a cyclic class of the given
 * order. Two conjugates never share one, since an element determines the
 * cyclic subgroup it generates, so each element names exactly one conjugate --
 * which is what makes it possible to pick two generators of the same class
 * that together generate more than either does alone.
 *
 * Each conjugate starts from its generator of smallest one-line form, and the
 * rest are its powers, read off its cycles in the order `orbitsUnder` walks
 * the class's automorphism exponents: orbit by orbit under the largest. So the
 * listing is stable, and every generator carries its exponent.
 */
export const generatorElements = (
  order: number,
  conjugates: readonly Subgroup[],
  autExponents: readonly number[],
): GeneratorChoices => {
  const exponents = orbitsUnder(
    order,
    autExponents,
    largestOrbitExponent(order, autExponents),
  ).flat();
  const elements: GeneratorElement[] = [];
  conjugates.forEach((subgroup, conjugate) => {
    const base = subgroup.elements
      .filter((element) => permutationOrder(element) === order)
      .reduce((a, b) => (permutationKey(b).localeCompare(permutationKey(a)) < 0 ? b : a));
    const powerOf = permutationPowers(base);
    for (const exponent of exponents) {
      elements.push({ permutation: powerOf(exponent), conjugate, exponent });
    }
  });
  return { elements };
};
