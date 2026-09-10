import type { SubgroupClass } from "@shared/mathUtils/groups/subgroupLattice";

const SUBSCRIPT_DIGITS = "₀₁₂₃₄₅₆₇₈₉";

const subscript = (n: number): string =>
  String(n)
    .split("")
    .map((digit) => SUBSCRIPT_DIGITS[Number(digit)])
    .join("");

/**
 * A class's label. Cyclic subgroups are named `C_n`; the whole group takes the
 * group's own name. Anything else shows only its order, since naming it needs
 * LMFDB's `subgroup_tex` and this lattice is computed rather than baked.
 * A class with conjugates carries their count as a left subscript, as LMFDB does.
 *
 * Lives apart from the lattice because the right-hand panel heads each open
 * section with the same name the lattice node carries, and the two must agree.
 */
export const classLabel = (
  subgroupClass: SubgroupClass,
  wholeOrder: number,
  wholeName: string,
): string => {
  const base =
    subgroupClass.order === wholeOrder
      ? wholeName
      : subgroupClass.cyclic
        ? `C${subscript(subgroupClass.order)}`
        : String(subgroupClass.order);
  return subgroupClass.count > 1 ? `${subscript(subgroupClass.count)}${base}` : base;
};
