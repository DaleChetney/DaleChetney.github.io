import { describe, it, expect } from "vitest";
import {
  clamp,
  distinctPrimeCount,
  primeDivisorCount,
  primeFactorization,
} from "@shared/mathUtils/math";

describe("clamp", () => {
  it("returns the value when within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it("clamps to the bounds", () => {
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});

describe("primeDivisorCount", () => {
  it.each([
    [1, 0],
    [2, 1],
    [3, 1],
    [4, 2],
    [6, 2],
    [12, 3],
    [64, 6],
  ])("counts %i with multiplicity as %i", (n, expected) => {
    expect(primeDivisorCount(n)).toBe(expected);
  });
});

describe("primeFactorization", () => {
  it.each([
    [1, []],
    [2, [[2, 1]]],
    [
      12,
      [
        [2, 2],
        [3, 1],
      ],
    ],
    [64, [[2, 6]]],
    [
      98,
      [
        [2, 1],
        [7, 2],
      ],
    ],
    [
      360,
      [
        [2, 3],
        [3, 2],
        [5, 1],
      ],
    ],
  ])("factors %i", (n, expected) => {
    expect(primeFactorization(n)).toEqual(expected);
  });
});

describe("distinctPrimeCount", () => {
  it.each([
    [1, 0],
    [2, 1],
    [8, 1],
    [12, 2],
    [360, 3],
  ])("counts the distinct primes of %i as %i", (n, expected) => {
    expect(distinctPrimeCount(n)).toBe(expected);
  });
});
