import type { BoundedLattice } from "fp-ts/BoundedLattice";
import type { Eq } from "fp-ts/Eq";
import {
  isSubsetOf,
  joinSubgroups,
  meetSubgroups,
  subgroupOf,
  type Subgroup,
} from "./subgroups.ts";

/** Subgroups are equal when they have the same elements, however they were generated. */
export const subgroupEq: Eq<Subgroup> = {
  equals: (a, b) => a.elements.length === b.elements.length && isSubsetOf(a, b),
};

/**
 * The subgroups of a group as a bounded lattice: join is the subgroup two
 * generate together, meet their intersection, `zero` the trivial subgroup and
 * `one` the group itself. Whether a selection generates the group is then
 * whether its join is `one`.
 *
 * Both operations are computed rather than looked up, which at these orders is
 * a closure of a few hundred elements — the lattice interface is for the
 * algebra, not for speed.
 */
export const subgroupBoundedLattice = (
  group: Subgroup,
  degree: number,
): BoundedLattice<Subgroup> => ({
  join: (a, b) => joinSubgroups(a, b, degree),
  meet: (a, b) => meetSubgroups(a, b, degree),
  zero: subgroupOf([], degree),
  one: group,
});
