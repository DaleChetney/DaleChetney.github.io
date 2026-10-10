const SUBSCRIPT_DIGITS = "₀₁₂₃₄₅₆₇₈₉";
const SUPERSCRIPT_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹";

const digitsIn =
  (alphabet: string) =>
  (n: number): string =>
    String(n)
      .split("")
      .map((digit) => alphabet[Number(digit)])
      .join("");

/** `n` written in subscript digits, e.g. `12` as `₁₂`. */
export const subscript = digitsIn(SUBSCRIPT_DIGITS);

/** `n` written in superscript digits, e.g. `12` as `¹²`. */
export const superscript = digitsIn(SUPERSCRIPT_DIGITS);
