import {
  composePermutations,
  permutationKey,
  type Permutation,
} from "@shared/mathUtils/groups/permutations";
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

/** The powers `g¹ … gⁿ⁻¹` of `g`, by key, so an element can look up its exponent. */
const exponentsOf = (g: Permutation): Map<string, number> => {
  const exponents = new Map<string, number>();
  let power = g;
  for (let exponent = 1; !exponents.has(permutationKey(power)); exponent++) {
    exponents.set(permutationKey(power), exponent);
    power = composePermutations(power, g);
  }
  return exponents;
};

/**
 * Short names for a class's generators, keyed by permutation key.
 *
 * Every generator of a cyclic subgroup is a power of any other, so the first
 * one listed for each conjugate is named by the class's letter and the rest as
 * its powers: `a`, `a²`, `a³`. When the class has several conjugates, each
 * carries its number as a subscript, as `b₁`, `b₂`, `b₂²`, matching the
 * "Conjugate n" heading it is listed under.
 */
export const generatorNames = (
  letter: string,
  choices: GeneratorChoices,
  conjugateCount: number,
): Map<string, string> => {
  const names = new Map<string, string>();
  const powersByConjugate = new Map<number, Map<string, number>>();
  for (const { permutation, conjugate } of choices.elements) {
    let powers = powersByConjugate.get(conjugate);
    if (powers === undefined) {
      powers = exponentsOf(permutation);
      powersByConjugate.set(conjugate, powers);
    }
    const key = permutationKey(permutation);
    const base = conjugateCount > 1 ? `${letter}${subscript(conjugate + 1)}` : letter;
    const exponent = powers.get(key);
    if (exponent === undefined) continue;
    names.set(key, exponent === 1 ? base : `${base}${superscript(exponent)}`);
  }
  return names;
};
