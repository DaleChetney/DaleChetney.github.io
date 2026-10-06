/**
 * Orbits of a cyclic group's generators under its automorphisms, worked
 * entirely in exponents.
 *
 * Every generator of Cₙ = ⟨g⟩ is gᵏ for a unit k mod n, and every automorphism
 * is g ↦ gᵐ for a unit m, sending gᵏ to gᵏᵐ. So an orbit is a run of exponents
 * k, km, km², …, and arranging the generators by orbit needs no permutation
 * at all: only which exponent each generator is.
 */

/** How many times ×m must be applied, mod n, to come back to 1. */
export const multiplicativeOrder = (m: number, n: number): number => {
  let order = 1;
  for (let x = m % n; x !== 1 % n; x = (x * m) % n) order++;
  return order;
};

/**
 * One exponent m for each nontrivial cyclic subgroup ⟨m⟩ of (ℤ/n)ˣ, so one
 * for every way the generators can be split into orbits of equal size.
 *
 * Every unit is a product of powers of the basis exponents. Those products are
 * walked by how many basis exponents they use, the singles first, then pairs,
 * and so on, and lexicographically by power within that; each keeps the first
 * product found to generate its subgroup. The subgroups are then listed
 * largest first, the walk's order breaking ties, so C₃₁ gives 3, 9, 27, …, 30
 * and C₂₄ gives 17, 13, 19 and then their products 5, 11, 7, 23.
 */
export const cyclicSubgroupExponents = (n: number, basis: readonly number[]): number[] => {
  const orders = basis.map((m) => multiplicativeOrder(m, n));
  let powers: number[][] = [[]];
  for (const order of orders) {
    powers = powers.flatMap((prefix) =>
      Array.from({ length: order }, (_, power) => [...prefix, power]),
    );
  }
  const support = (vector: readonly number[]) =>
    vector.flatMap((power, index) => (power === 0 ? [] : [index]));
  const bySupport = (a: readonly number[], b: readonly number[]): number => {
    const [sa, sb] = [support(a), support(b)];
    if (sa.length !== sb.length) return sa.length - sb.length;
    const differs = sa.findIndex((index, i) => index !== sb[i]);
    return differs === -1 ? 0 : sa[differs] - sb[differs];
  };

  const seen = new Set<string>();
  const found: { m: number; size: number }[] = [];
  for (const vector of [...powers].sort(bySupport)) {
    const m = vector.reduce((product, power, i) => {
      let result = product;
      for (let step = 0; step < power; step++) result = (result * basis[i]) % n;
      return result;
    }, 1 % n);
    const subgroup = orbitsUnder(n, [], m)[0];
    const key = [...subgroup].sort((a, b) => a - b).join(",");
    if (subgroup.length < 2 || seen.has(key)) continue;
    seen.add(key);
    found.push({ m, size: subgroup.length });
  }
  return found.sort((a, b) => b.size - a.size).map(({ m }) => m);
};

/**
 * The exponent whose orbits are largest: the first of `cyclicSubgroupExponents`.
 * Undefined when there is no automorphism to choose, as for C₁ and C₂.
 */
export const largestOrbitExponent = (n: number, basis: readonly number[]): number | undefined =>
  cyclicSubgroupExponents(n, basis)[0];

/**
 * The units mod n arranged as orbits under ×`inner`: its orbit through 1
 * first, then each other exponent, in the order given, applied to every orbit
 * reached so far until it brings nothing new.
 *
 * `exponents` must be a basis of (ℤ/n)ˣ, as the bake checks LMFDB's are; then
 * this reaches every unit exactly once, and every orbit is the same size.
 */
export const orbitsUnder = (
  n: number,
  exponents: readonly number[],
  inner: number | undefined,
): number[][] => {
  const first = [1 % n];
  if (inner !== undefined) {
    for (let k = (inner * first[0]) % n; k !== first[0]; k = (k * inner) % n) first.push(k);
  }
  const orbits = [first];
  const reached = new Set(first);
  for (const m of exponents) {
    if (m === inner) continue;
    const before = [...orbits];
    for (let factor = m % n; !reached.has(factor); factor = (factor * m) % n) {
      for (const orbit of before) {
        const image = orbit.map((k) => (k * factor) % n);
        image.forEach((k) => reached.add(k));
        orbits.push(image);
      }
    }
  }
  return orbits;
};
