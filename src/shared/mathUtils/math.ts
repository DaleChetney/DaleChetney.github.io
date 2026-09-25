export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/** A prime and the power it divides `n` to, e.g. `[2, 3]` for the 8 in 24. */
export type PrimePower = readonly [prime: number, exponent: number];

/** The prime factorization of `n`, smallest prime first; empty for 1. */
export const primeFactorization = (n: number): PrimePower[] => {
  const powers: PrimePower[] = [];
  let remaining = n;
  for (let factor = 2; factor * factor <= remaining; factor++) {
    let exponent = 0;
    while (remaining % factor === 0) {
      remaining /= factor;
      exponent++;
    }
    if (exponent > 0) powers.push([factor, exponent]);
  }
  if (remaining > 1) powers.push([remaining, 1]);
  return powers;
};

/** Number of prime divisors of `n` counted with multiplicity: Ω(n). */
export const primeDivisorCount = (n: number): number =>
  primeFactorization(n).reduce((total, [, exponent]) => total + exponent, 0);

/** Number of distinct prime divisors of `n`: ω(n). */
export const distinctPrimeCount = (n: number): number => primeFactorization(n).length;
