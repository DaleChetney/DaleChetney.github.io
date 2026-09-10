export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/** Number of prime divisors of `n` counted with multiplicity. */
export const primeDivisorCount = (n: number): number => {
  let remaining = n;
  let count = 0;
  for (let factor = 2; factor * factor <= remaining; factor++) {
    while (remaining % factor === 0) {
      remaining /= factor;
      count++;
    }
  }
  return remaining > 1 ? count + 1 : count;
};
