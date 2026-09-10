import {
  composePermutations,
  generatePermutationGroup,
  identityPermutation,
  invertPermutation,
  permutationKey,
  permutationOrder,
  type Permutation,
} from "./permutations";

/**
 * An isomorphism between two faithful permutation representations of the same
 * abstract group, from one-line keys in the source to permutations in the
 * target.
 */
export type GroupIsomorphism = ReadonlyMap<string, Permutation>;

const conjugate = (element: Permutation, by: Permutation): Permutation =>
  composePermutations(composePermutations(by, element), invertPermutation(by));

const subsets = <T>(items: readonly T[], size: number): T[][] => {
  if (size === 0) return [[]];
  if (items.length < size) return [];
  const [first, ...rest] = items;
  return [...subsets(rest, size - 1).map((subset) => [first, ...subset]), ...subsets(rest, size)];
};

/**
 * The fewest of `generators` that still generate the whole group.
 *
 * Worth the search: the isomorphism below tries every assignment of images to
 * these, so one generator fewer divides the work by the order of the group.
 */
export const minimalGenerators = (
  generators: readonly Permutation[],
  degree: number,
): Permutation[] => {
  const order = generatePermutationGroup(generators, degree).length;
  for (let size = 1; size < generators.length; size++) {
    for (const subset of subsets(generators, size)) {
      if (generatePermutationGroup(subset, degree).length === order) return subset;
    }
  }
  return [...generators];
};

/**
 * One element of each conjugacy class of the given order.
 *
 * The first generator only has to be tried against these: composing an
 * isomorphism with conjugation in the target is again an isomorphism, so if any
 * exists sending the generator into a class, one exists sending it to whichever
 * member of that class we picked.
 */
const classRepresentatives = (elements: readonly Permutation[], order: number): Permutation[] => {
  const seen = new Set<string>();
  const representatives: Permutation[] = [];
  for (const element of elements) {
    if (permutationOrder(element) !== order || seen.has(permutationKey(element))) continue;
    representatives.push(element);
    for (const by of elements) seen.add(permutationKey(conjugate(element, by)));
  }
  return representatives;
};

/**
 * Extend `generators -> images` over the whole group, or fail.
 *
 * Walks the source's Cayley graph, carrying each element's image with it. A map
 * that survives the walk agrees with left multiplication by every generator, so
 * by induction over words it is a homomorphism; keeping the images distinct as
 * they are assigned makes it an isomorphism once every element is reached.
 */
const extend = (
  generators: readonly Permutation[],
  sourceDegree: number,
  images: readonly Permutation[],
  targetDegree: number,
  order: number,
): Map<string, Permutation> | null => {
  const start = identityPermutation(sourceDegree);
  const mapped = new Map<string, Permutation>([
    [permutationKey(start), identityPermutation(targetDegree)],
  ]);
  const used = new Set<string>([permutationKey(identityPermutation(targetDegree))]);
  const queue: Permutation[] = [start];

  for (let i = 0; i < queue.length; i++) {
    const element = queue[i];
    const image = mapped.get(permutationKey(element));
    if (image === undefined) return null;
    for (let g = 0; g < generators.length; g++) {
      const next = composePermutations(generators[g], element);
      const nextImage = composePermutations(images[g], image);
      const seen = mapped.get(permutationKey(next));
      if (seen === undefined) {
        if (used.has(permutationKey(nextImage))) return null;
        mapped.set(permutationKey(next), nextImage);
        used.add(permutationKey(nextImage));
        queue.push(next);
      } else if (permutationKey(seen) !== permutationKey(nextImage)) {
        return null;
      }
    }
  }
  return mapped.size === order ? mapped : null;
};

/**
 * Every way of choosing one entry from each list, in order and lazily. The
 * product runs to the order of the group per generator past the first, which is
 * a lot of tuples to hold when only the first one that works is wanted.
 */
function* tuples(
  choices: readonly (readonly Permutation[])[],
  prefix: Permutation[] = [],
): Generator<Permutation[]> {
  if (prefix.length === choices.length) {
    yield prefix;
    return;
  }
  for (const option of choices[prefix.length]) {
    yield* tuples(choices, [...prefix, option]);
  }
}

/**
 * An isomorphism from one permutation representation of a group to another, or
 * null if they are not isomorphic.
 *
 * Which isomorphism is not canonical — any two differ by an automorphism, and a
 * group with outer automorphisms has no preferred one. What it does guarantee is
 * structure: a subgroup maps to a subgroup of the same order, a generating set
 * to a generating set. That is enough to carry a selection from one picture of a
 * group to another.
 */
export const findIsomorphism = (
  source: readonly Permutation[],
  sourceDegree: number,
  target: readonly Permutation[],
  targetDegree: number,
): GroupIsomorphism | null => {
  const generators = minimalGenerators(source, sourceDegree);
  const sourceOrder = generatePermutationGroup(generators, sourceDegree).length;
  const targetElements = generatePermutationGroup(target, targetDegree);
  if (sourceOrder !== targetElements.length) return null;

  const byOrder = new Map<number, Permutation[]>();
  for (const element of targetElements) {
    const order = permutationOrder(element);
    byOrder.set(order, [...(byOrder.get(order) ?? []), element]);
  }

  const candidates = generators.map((generator, index) =>
    index === 0
      ? classRepresentatives(targetElements, permutationOrder(generator))
      : (byOrder.get(permutationOrder(generator)) ?? []),
  );

  for (const images of tuples(candidates)) {
    const mapped = extend(generators, sourceDegree, images, targetDegree, sourceOrder);
    if (mapped !== null) return mapped;
  }
  return null;
};
