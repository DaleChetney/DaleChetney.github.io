import { describe, it, expect } from "vitest";
import { permutationFromCycles, permutationKey } from "@shared/mathUtils/groups/permutations";
import type { GeneratorChoices } from "@shared/mathUtils/groups/generatorChoices";
import { classLetter, generatorNames } from "./generatorNames";

/** Distinct stand-in permutations: naming reads only the exponent and conjugate. */
const choices = (spec: readonly (readonly [number, number])[]): GeneratorChoices => ({
  elements: spec.map(([exponent, conjugate], i) => ({
    permutation: permutationFromCycles([[1, i + 2]], spec.length + 1),
    conjugate,
    exponent,
  })),
});

const namesOf = (letter: string, spec: readonly (readonly [number, number])[], count: number) => {
  const listed = choices(spec);
  const names = generatorNames(letter, listed, count);
  return listed.elements.map(({ permutation }) => names.get(permutationKey(permutation)));
};

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
  it("names each generator as the power of its conjugate's first that it is", () => {
    const spec = [1, 3, 9, 11].map((exponent) => [exponent, 0] as const);
    expect(namesOf("a", spec, 1)).toEqual(["a", "a³", "a⁹", "a¹¹"]);
  });

  it("subscripts each conjugate's letter with its number", () => {
    const spec = [
      [1, 0],
      [2, 0],
      [1, 1],
      [2, 1],
    ] as const;
    expect(namesOf("b", spec, 2)).toEqual(["b₁", "b₁²", "b₂", "b₂²"]);
  });
});
