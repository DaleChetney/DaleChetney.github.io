const SUBSCRIPT_DIGITS = "₀₁₂₃₄₅₆₇₈₉";
const SUPERSCRIPT_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹";

/**
 * Every macro LMFDB uses in the `tex_name` of a group, `aut_tex` of its
 * automorphism group, or `subgroup_tex` of a subgroup inside our bounds, and
 * nothing else. Anything outside this list is a change in the source data
 * rather than something to guess at, so it raises instead of rendering.
 */
const MACROS: Readonly<Record<string, string>> = {
  times: " × ",
  wr: " ≀ ",
  OD: "OD",
  SD: "SD",
  He: "He",
  SL: "SL",
  PSU: "PSU",
  SOPlus: "SO⁺",
  GL: "GL",
  PGL: "PGL",
  PSL: "PSL",
  SU: "SU",
  PU: "PU",
  Unitary: "U",
};

const digits = (value: string, table: string): string =>
  value
    .split("")
    .map((digit) => table[Number(digit)])
    .join("");

/**
 * Render LMFDB's `tex_name` as plain Unicode, e.g. `C_2\times \SD_{16}` as
 * `C₂ × SD₁₆`.
 *
 * The vocabulary here is small and closed: across the groups, automorphism
 * groups and subgroups we bake it is the macros above plus `\mathbb{Z}`,
 * integer subscripts, and single-digit superscripts.
 * `:` is a semidirect product and `.` a non-split extension, which is why only
 * the first gets spaced out.
 */
export const texToUnicode = (tex: string): string => {
  const expanded = tex
    .replace(/\\mathbb\{Z\}/g, "ℤ")
    .replace(/\\([A-Za-z]+)\s*/g, (_, name: string) => {
      const replacement = MACROS[name];
      if (replacement === undefined)
        throw new RangeError(`Unknown TeX macro \\${name} in "${tex}"`);
      return replacement;
    });

  return expanded
    .replace(/_\{([0-9]+)\}|_([0-9])/g, (_, braced: string | undefined, bare: string | undefined) =>
      digits(braced ?? bare ?? "", SUBSCRIPT_DIGITS),
    )
    .replace(
      /\^\{([0-9]+)\}|\^([0-9])/g,
      (_, braced: string | undefined, bare: string | undefined) =>
        digits(braced ?? bare ?? "", SUPERSCRIPT_DIGITS),
    )
    .replace(/:/g, " ⋊ ")
    .replace(/\s+/g, " ")
    .trim();
};
