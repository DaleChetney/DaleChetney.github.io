/**
 * What the bake knows about a subgroup class from either side: the lattice it
 * computed from a permutation representation, or the rows LMFDB stores.
 */
export interface ClassShape {
  order: number;
  count: number;
  cyclic: boolean;
  /** Indices of the classes immediately below this one. */
  covers: readonly number[];
}

const fail = (message: string): never => {
  throw new Error(`Subgroup classes do not match: ${message}`);
};

/**
 * One signature per class, refined until the partition stops changing: start
 * from the invariants, then fold in the sorted signatures of the classes each
 * covers and is covered by. Classes that end up sharing a signature are, as
 * far as the lattice can tell, interchangeable.
 */
const signatures = (classes: readonly ClassShape[]): string[] => {
  const coveredBy = classes.map((): number[] => []);
  classes.forEach((c, i) => {
    for (const lower of c.covers) coveredBy[lower].push(i);
  });

  let current = classes.map((c) => `${String(c.order)}:${String(c.count)}:${c.cyclic ? "c" : "n"}`);
  for (;;) {
    const refined = current.map((signature, i) => {
      const below = classes[i].covers.map((j) => current[j]).sort();
      const above = coveredBy[i].map((j) => current[j]).sort();
      return `${signature}|${below.join(",")}|${above.join(",")}`;
    });
    if (new Set(refined).size === new Set(current).size) return current;
    // Relabel each round so the strings stay short however deep the lattice.
    // Numbered in sorted order, not order of appearance, so that the two sides
    // give the same label to the same kind of class.
    const ids = new Map([...new Set(refined)].sort().map((signature, id) => [signature, id]));
    current = refined.map((signature) => String(ids.get(signature)));
  }
};

/**
 * Pair each class of `source` with the class of `target` it must be, so that
 * `result[i]` indexes `target`. Invariants and the cover relation are both
 * preserved; where several classes are indistinguishable (automorphic images,
 * like the seven C_2s of C_2^3) any assignment consistent with the covers is
 * taken, since nothing downstream can tell them apart either.
 *
 * Throws, naming the discrepancy, when no such pairing exists: a bake that
 * cannot match its computed lattice to LMFDB's is one that must not ship.
 */
export const matchSubgroupClasses = (
  source: readonly ClassShape[],
  target: readonly ClassShape[],
): number[] => {
  if (source.length !== target.length) {
    fail(`${String(source.length)} classes computed, LMFDB has ${String(target.length)}`);
  }
  const sourceSignatures = signatures(source);
  const targetSignatures = signatures(target);
  const sortedSource = [...sourceSignatures].sort();
  const sortedTarget = [...targetSignatures].sort();
  const differ = sortedSource.findIndex((signature, i) => signature !== sortedTarget[i]);
  if (differ !== -1) {
    fail(`signature ${sortedSource[differ]} computed against ${sortedTarget[differ]} in LMFDB`);
  }

  const covers = (classes: readonly ClassShape[]): Set<number>[] =>
    classes.map((c) => new Set(c.covers));
  const sourceCovers = covers(source);
  const targetCovers = covers(target);

  const matching = new Array<number>(source.length).fill(-1);
  const used = new Set<number>();

  /** Whether sending `i` to `t` agrees with every pair already assigned. */
  const consistent = (i: number, t: number): boolean =>
    matching.every(
      (m, j) =>
        m === -1 ||
        (sourceCovers[i].has(j) === targetCovers[t].has(m) &&
          sourceCovers[j].has(i) === targetCovers[m].has(t)),
    );

  const assign = (i: number): boolean => {
    if (i === source.length) return true;
    for (let t = 0; t < target.length; t++) {
      if (used.has(t) || targetSignatures[t] !== sourceSignatures[i] || !consistent(i, t)) {
        continue;
      }
      matching[i] = t;
      used.add(t);
      if (assign(i + 1)) return true;
      matching[i] = -1;
      used.delete(t);
    }
    return false;
  };

  if (!assign(0)) fail("no pairing of the classes preserves the covers");
  return matching;
};
