import { el } from "@shared/dom";
import type { CatalogueGroup } from "../catalogue";

/** The category of the simple groups LMFDB files under cyclic: those of prime order. */
export const ABELIAN_SIMPLE = 14;
/** The category of the simple groups LMFDB files under non-solvable. */
export const NON_ABELIAN_SIMPLE = 15;

/**
 * The filter's categories, in the order the dropdown offers them. Codes 0–13
 * are LMFDB's `solvability_type`: where along the spectrum from cyclic to
 * non-solvable a group sits. The simple groups are taken out of the two ends
 * into categories of their own, each placed beside the one it came out of.
 * Each group is in exactly one.
 */
export const GROUP_CATEGORIES: readonly { code: number; name: string }[] = [
  { code: ABELIAN_SIMPLE, name: "simple and abelian" },
  { code: 0, name: "cyclic, not simple" },
  { code: 1, name: "abelian and metacyclic" },
  { code: 2, name: "abelian, not metacyclic" },
  { code: 3, name: "nilpotent and metacyclic" },
  { code: 4, name: "nilpotent and metabelian" },
  { code: 5, name: "nilpotent, not metabelian" },
  { code: 6, name: "metacyclic, not nilpotent" },
  { code: 7, name: "metabelian and supersolvable" },
  { code: 8, name: "metabelian and monomial" },
  { code: 9, name: "metabelian, not monomial" },
  { code: 10, name: "supersolvable, not metabelian" },
  { code: 11, name: "monomial, not metabelian" },
  { code: 12, name: "not monomial or metabelian" },
  { code: 13, name: "not solvable or simple" },
  { code: NON_ABELIAN_SIMPLE, name: "simple, not abelian" },
];

/** A simple group's own category; any other group's LMFDB solvability type. */
export const groupCategory = (group: CatalogueGroup): number =>
  group.simple ? (group.abelian ? ABELIAN_SIMPLE : NON_ABELIAN_SIMPLE) : group.solvabilityType;

export interface CategoryOption {
  code: number;
  name: string;
  count: number;
}

/**
 * The categories some group in the catalogue is in, in the dropdown's order,
 * each with how many. Categories no group is in are left out, so every option
 * the dropdown offers shows at least one row.
 */
export const categoryOptions = (groups: readonly CatalogueGroup[]): CategoryOption[] => {
  const counts = new Map<number, number>();
  for (const group of groups) {
    const code = groupCategory(group);
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return GROUP_CATEGORIES.flatMap(({ code, name }) => {
    const count = counts.get(code);
    return count === undefined ? [] : [{ code, name, count }];
  });
};

/** The dropdown's options: everything first, then one per category. */
export const renderFilterOptions = (options: readonly CategoryOption[]): HTMLOptionElement[] => [
  el("option", { value: "" }, ["All groups"]),
  ...options.map((option) =>
    el("option", { value: String(option.code) }, [`${option.name} (${String(option.count)})`]),
  ),
];

/** Groups in category `code`, or all of them when `code` is `null`. */
export const filterGroups = (
  groups: readonly CatalogueGroup[],
  code: number | null,
): CatalogueGroup[] =>
  code === null ? [...groups] : groups.filter((group) => groupCategory(group) === code);
