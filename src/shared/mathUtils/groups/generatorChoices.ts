import { permutationOrder, type Permutation } from "./permutations";
import type { SubgroupClass } from "./subgroupLattice";

/** One element that generates a subgroup in a class, and which conjugate it generates. */
export interface GeneratorElement {
  permutation: Permutation;
  /** Index into the class's `conjugates`. */
  conjugate: number;
}

export interface GeneratorChoices {
  elements: GeneratorElement[];
  /** How many there were before `limit` was applied. */
  total: number;
}

/**
 * The elements that generate the subgroups in a class: those whose order equals
 * the subgroup order. Two conjugates never share one, since an element
 * determines the cyclic subgroup it generates, so each element names exactly one
 * conjugate -- which is what makes it possible to pick two generators of the
 * same class that together generate more than either does alone.
 *
 * Ordered by conjugate, then by the element's one-line form, so the listing is
 * stable; `limit` caps how many are returned, not how many are counted.
 */
export const generatorElements = (
  subgroupClass: SubgroupClass,
  limit: number,
): GeneratorChoices => {
  const elements: GeneratorElement[] = [];
  subgroupClass.conjugates.forEach((conjugate, index) => {
    const generators = conjugate.elements
      .filter((element) => permutationOrder(element) === subgroupClass.order)
      .sort((a, b) => a.join(",").localeCompare(b.join(",")));
    for (const permutation of generators) {
      elements.push({ permutation, conjugate: index });
    }
  });
  return { elements: elements.slice(0, limit), total: elements.length };
};
