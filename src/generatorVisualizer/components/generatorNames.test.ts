import { describe, it, expect } from "vitest";
import {
  permutationFromCycles,
  permutationKey,
  type Permutation,
} from "@shared/mathUtils/groups/permutations";
import { classLetter, generatorNames } from "./generatorNames";

const cycle = (...points: number[]): Permutation => permutationFromCycles([points], 5);

const choices = (spec: readonly (readonly [Permutation, number])[]) => ({
  elements: spec.map(([permutation, conjugate]) => ({ permutation, conjugate })),
  total: spec.length,
});

const named = (names: Map<string, string>, permutation: Permutation) =>
  names.get(permutationKey(permutation));

describe("classLetter", () => {
  it("runs through the alphabet, then doubles up", () => {
    expect(classLetter(0)).toBe("a");
    expect(classLetter(1)).toBe("b");
    expect(classLetter(25)).toBe("z");
    expect(classLetter(26)).toBe("aa");
    expect(classLetter(27)).toBe("ab");
  });
});

describe("generatorNames", () => {
  it("names the rest of a cyclic subgroup's generators as powers of the first", () => {
    const a = cycle(1, 5, 2, 4, 3);
    const elements = [a, cycle(1, 2, 3, 5, 4), cycle(1, 4, 5, 3, 2), cycle(1, 3, 4, 2, 5)];
    const names = generatorNames("a", choices(elements.map((g) => [g, 0])), 1);
    expect(elements.map((g) => named(names, g))).toEqual(["a", "a²", "a³", "a⁴"]);
  });

  it("subscripts each conjugate's letter with its number", () => {
    const names = generatorNames(
      "b",
      choices([
        [cycle(1, 2, 3), 0],
        [cycle(1, 3, 2), 0],
        [cycle(2, 4, 5), 1],
        [cycle(2, 5, 4), 1],
      ]),
      2,
    );
    expect(named(names, cycle(1, 2, 3))).toBe("b₁");
    expect(named(names, cycle(1, 3, 2))).toBe("b₁²");
    expect(named(names, cycle(2, 4, 5))).toBe("b₂");
    expect(named(names, cycle(2, 5, 4))).toBe("b₂²");
  });

  it("writes a multi-digit exponent in superscript", () => {
    const g = permutationFromCycles([[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]], 11);
    const names = generatorNames(
      "c",
      choices([
        [g, 0],
        [g.map((_, i) => g[g[i] - 1]), 0],
      ]),
      1,
    );
    expect([...names.values()]).toEqual(["c", "c²"]);
    const inverse = permutationFromCycles([[1, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2]], 11);
    expect(
      named(
        generatorNames(
          "c",
          choices([
            [g, 0],
            [inverse, 0],
          ]),
          1,
        ),
        inverse,
      ),
    ).toBe("c¹⁰");
  });

  it("leaves unnamed an element that is no power of its conjugate's first", () => {
    const names = generatorNames(
      "a",
      choices([
        [cycle(1, 2, 3), 0],
        [cycle(1, 2), 0],
      ]),
      1,
    );
    expect(named(names, cycle(1, 2))).toBeUndefined();
  });
});
