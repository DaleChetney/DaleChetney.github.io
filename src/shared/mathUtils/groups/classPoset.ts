/**
 * The subgroup classes of a group ordered by containment: a bounded poset,
 * not a lattice, since two classes can have several minimal common upper
 * classes (in A5, [C2] and [C3] lie under both [S3] and [A4]). Joins belong to
 * concrete subgroups; what the classes give is which nodes lie under which.
 */
export interface ClassPoset {
  readonly size: number;
  /** The trivial subgroup's class. */
  readonly bottom: number;
  /** The whole group's class. */
  readonly top: number;
  /** Whether `lower` lies strictly below `upper`. */
  below(lower: number, upper: number): boolean;
  /** Every class at or below `index`. */
  downSet(index: number): ReadonlySet<number>;
  /** Every class at or above `index`. */
  upSet(index: number): ReadonlySet<number>;
}

const single = (candidates: number[], what: string): number => {
  if (candidates.length !== 1) {
    throw new Error(`Class poset has ${String(candidates.length)} ${what} classes, not one`);
  }
  return candidates[0];
};

/**
 * Build the poset from cover relations: `covers[i]` lists the classes
 * immediately below class `i`, as LMFDB's `contains` does.
 */
export const classPoset = (covers: readonly (readonly number[])[]): ClassPoset => {
  const down = covers.map((_, i) => new Set<number>([i]));
  // Down-sets by fixpoint over the covers. With at most a few dozen classes
  // this converges in a handful of passes and needs no topological order.
  for (let changed = true; changed;) {
    changed = false;
    covers.forEach((lowers, i) => {
      for (const lower of lowers) {
        for (const member of down[lower]) {
          if (down[i].has(member)) continue;
          down[i].add(member);
          changed = true;
        }
      }
    });
  }
  const up = covers.map(() => new Set<number>());
  down.forEach((members, i) => {
    for (const member of members) up[member].add(i);
  });

  const indices = covers.map((_, i) => i);
  return {
    size: covers.length,
    bottom: single(
      indices.filter((i) => down[i].size === 1),
      "bottom",
    ),
    top: single(
      indices.filter((i) => up[i].size === 1),
      "top",
    ),
    below: (lower, upper) => lower !== upper && down[upper].has(lower),
    downSet: (index) => down[index],
    upSet: (index) => up[index],
  };
};
