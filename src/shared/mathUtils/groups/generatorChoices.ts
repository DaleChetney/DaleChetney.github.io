import { permutationKey, permutationOrder, type Permutation } from "./permutations.ts";
import type { Subgroup } from "./subgroups.ts";

/** One element that generates a subgroup in a class, and which conjugate it generates. */
export interface GeneratorElement {
  permutation: Permutation;
  /** Index into the class's conjugates. */
  conjugate: number;
}

export interface GeneratorChoices {
  elements: GeneratorElement[];
  /** How many there were before `limit` was applied. */
  total: number;
}

/**
 * The elements that generate the subgroups in a cyclic class of the given
 * order: those whose order equals the subgroup order. Two conjugates never
 * share one, since an element determines the cyclic subgroup it generates, so
 * each element names exactly one conjugate -- which is what makes it possible
 * to pick two generators of the same class that together generate more than
 * either does alone.
 *
 * Ordered by conjugate, then by the element's one-line form, so the listing is
 * stable; `limit` caps how many are returned, not how many are counted.
 */
export const generatorElements = (
  order: number,
  conjugates: readonly Subgroup[],
  limit: number,
): GeneratorChoices => {
  const elements: GeneratorElement[] = [];
  conjugates.forEach((conjugate, index) => {
    const generators = conjugate.elements
      .filter((element) => permutationOrder(element) === order)
      .sort((a, b) => permutationKey(a).localeCompare(permutationKey(b)));
    for (const permutation of generators) {
      elements.push({ permutation, conjugate: index });
    }
  });
  return { elements: elements.slice(0, limit), total: elements.length };
};
