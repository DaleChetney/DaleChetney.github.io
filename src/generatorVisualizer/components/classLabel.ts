import type { CatalogueSubgroupClass } from "../catalogue";

const SUBSCRIPT_DIGITS = "₀₁₂₃₄₅₆₇₈₉";

const subscript = (n: number): string =>
  String(n)
    .split("")
    .map((digit) => SUBSCRIPT_DIGITS[Number(digit)])
    .join("");

/**
 * A class's label: LMFDB's name for the subgroup, except that the whole group
 * takes the group's own name. A class with conjugates carries their count as
 * a left subscript, as LMFDB does.
 *
 * Lives apart from the lattice because the right-hand panel heads each open
 * section with the same name the lattice node carries, and the two must agree.
 */
export const classLabel = (
  subgroupClass: Pick<CatalogueSubgroupClass, "order" | "count" | "displayName">,
  wholeOrder: number,
  wholeName: string,
): string => {
  const base = subgroupClass.order === wholeOrder ? wholeName : subgroupClass.displayName;
  return subgroupClass.count > 1 ? `${subscript(subgroupClass.count)}${base}` : base;
};
