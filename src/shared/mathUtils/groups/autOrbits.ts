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
 * The exponent whose orbits are largest, which is the one of largest
 * multiplicative order; the first listed wins a tie. Undefined when there is
 * no automorphism to choose, as for C₁ and C₂.
 */
export const largestOrbitExponent = (n: number, exponents: readonly number[]): number | undefined =>
  exponents.reduce<number | undefined>(
    (best, m) =>
      best === undefined || multiplicativeOrder(m, n) > multiplicativeOrder(best, n) ? m : best,
    undefined,
  );

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
