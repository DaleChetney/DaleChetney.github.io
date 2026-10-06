import { permutationKey } from "@shared/mathUtils/groups/permutations";
import type { GeneratorChoices } from "@shared/mathUtils/groups/generatorChoices";
import { subscript, superscript } from "./scriptDigits";

/**
 * The letter for the `index`th selectable class: `a` to `z`, then `aa`, `ab`,
 * and so on, should a group ever have more cyclic classes than that.
 */
export const classLetter = (index: number): string => {
  let letters = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCharCode(97 + ((n - 1) % 26)) + letters;
  }
  return letters;
};

/**
 * Short names for a class's generators, keyed by permutation key.
 *
 * Every generator of a cyclic subgroup is a power of any other, and each
 * already carries which power of its conjugate's first generator it is, so the
 * first is named by the class's letter and the rest by their exponents: `a`,
 * `a³`, `a⁹`. When the class has several conjugates, each carries its number
 * as a subscript, as `b₁`, `b₂`, `b₂²`, matching the "Conjugate n" heading it
 * is listed under.
 */
export const generatorNames = (
  letter: string,
  choices: GeneratorChoices,
  conjugateCount: number,
): Map<string, string> =>
  new Map(
    choices.elements.map(({ permutation, conjugate, exponent }) => {
      const base = conjugateCount > 1 ? `${letter}${subscript(conjugate + 1)}` : letter;
      return [
        permutationKey(permutation),
        exponent === 1 ? base : `${base}${superscript(exponent)}`,
      ];
    }),
  );
