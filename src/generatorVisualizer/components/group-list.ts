import { el } from "@shared/dom";
import { superscript } from "@shared/mathUtils/groups/tex";
import { primeFactorization } from "@shared/mathUtils/math";
import type { CatalogueGroup } from "../catalogue";

export interface GroupListView {
  selected: string | null;
  onSelect: (label: string) => void;
}

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
  { code: 1, name: "abelian and metacyclic, not cyclic" },
  { code: 2, name: "abelian, not metacyclic" },
  { code: 3, name: "nilpotent and metacyclic, not abelian" },
  { code: 4, name: "nilpotent and metabelian, not abelian or metacyclic" },
  { code: 5, name: "nilpotent, not metabelian" },
  { code: 6, name: "metacyclic, not nilpotent" },
  { code: 7, name: "metabelian and supersolvable, not nilpotent or metacyclic" },
  { code: 8, name: "metabelian and monomial, not supersolvable" },
  { code: 9, name: "metabelian, not monomial" },
  { code: 10, name: "supersolvable, not nilpotent or metabelian" },
  { code: 11, name: "monomial, not supersolvable or metabelian" },
  { code: 12, name: "solvable, not monomial or metabelian" },
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

/** `2³·3²·5` for 360; a prime or 1 is just itself. */
export const factorizationText = (n: number): string =>
  primeFactorization(n)
    .map(([prime, exponent]) => String(prime) + (exponent === 1 ? "" : superscript(exponent)))
    .join("·") || String(n);

/**
 * `12.1 · order 2²·3`, plus the nilpotency class when there is one.
 */
const groupMeta = (group: CatalogueGroup): string => {
  const parts = [group.label, `order ${factorizationText(group.order)}`];
  if (group.abelian) {
    parts.push(`abelian`);
  } else if (group.nilpotent) parts.push(`nilpotency ${String(group.nilpotencyClass)}`);
  return parts.join(" · ");
};

const groupRow = (group: CatalogueGroup, view: GroupListView): HTMLElement => {
  const row = el("button", { className: "group-row", type: "button" }, [
    el("span", { className: "group-name" }, [group.displayName]),
    el("span", { className: "group-meta" }, [groupMeta(group)]),
  ]);
  row.dataset.label = group.label;
  if (group.label === view.selected) {
    row.classList.add("selected");
    row.setAttribute("aria-current", "true");
  }
  row.addEventListener("click", () => {
    view.onSelect(group.label);
  });
  return row;
};

/**
 * The left panel's list. Every match is rendered: the catalogue is currently small enough
 * that the browser will keep responsive, and the alternative costs scroll fidelity.
 */
export const renderGroupList = (
  groups: readonly CatalogueGroup[],
  view: GroupListView,
): HTMLElement =>
  groups.length === 0
    ? el("p", { className: "placeholder" }, ["No group matches."])
    : el(
        "div",
        { className: "group-list" },
        groups.map((group) => groupRow(group, view)),
      );

/** `402 groups` or `3 of 402 groups`, for the caption above the list. */
export const groupListCaption = (shown: number, total: number): string =>
  shown === total
    ? `${String(total)} groups`
    : `${String(shown)} of ${String(total)} group${total === 1 ? "" : "s"}`;
