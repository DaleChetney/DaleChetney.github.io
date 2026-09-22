import { el } from "@shared/dom";
import type { CatalogueGroup } from "../catalogue";

export interface GroupListView {
  selected: string | null;
  onSelect: (label: string) => void;
}

/**
 * LMFDB's `solvability_type`, indexed by its code: where along the spectrum
 * from cyclic to non-solvable a group sits. Each group has exactly one.
 */
export const SOLVABILITY_TYPES: readonly string[] = [
  "cyclic",
  "abelian and metacyclic, not cyclic",
  "abelian, not metacyclic",
  "nilpotent and metacyclic, not abelian",
  "nilpotent and metabelian, not abelian or metacyclic",
  "nilpotent, not metabelian",
  "metacyclic, not nilpotent",
  "metabelian and supersolvable, not nilpotent or metacyclic",
  "metabelian and monomial, not supersolvable",
  "metabelian, not monomial",
  "supersolvable, not nilpotent or metabelian",
  "monomial, not supersolvable or metabelian",
  "solvable, not monomial or metabelian",
  "not solvable",
];

export interface SolvabilityOption {
  type: number;
  name: string;
  count: number;
}

/**
 * The solvability types some group in the catalogue has, in LMFDB's order,
 * each with how many. Types no group has are left out, so every option the
 * dropdown offers shows at least one row.
 */
export const solvabilityOptions = (groups: readonly CatalogueGroup[]): SolvabilityOption[] => {
  const counts = new Map<number, number>();
  for (const group of groups) {
    counts.set(group.solvabilityType, (counts.get(group.solvabilityType) ?? 0) + 1);
  }
  return SOLVABILITY_TYPES.flatMap((name, type) => {
    const count = counts.get(type);
    return count === undefined ? [] : [{ type, name, count }];
  });
};

/** The dropdown's options: everything first, then one per solvability type. */
export const renderFilterOptions = (options: readonly SolvabilityOption[]): HTMLOptionElement[] => [
  el("option", { value: "" }, ["All groups"]),
  ...options.map((option) =>
    el("option", { value: String(option.type) }, [`${option.name} (${String(option.count)})`]),
  ),
];

/** Groups of solvability type `type`, or all of them when `type` is `null`. */
export const filterGroups = (
  groups: readonly CatalogueGroup[],
  type: number | null,
): CatalogueGroup[] =>
  type === null ? [...groups] : groups.filter((group) => group.solvabilityType === type);

/** `12.1 · order 12 · rank 2`, plus the nilpotency class when there is one. */
const groupMeta = (group: CatalogueGroup): string => {
  const parts = [group.label, `order ${String(group.order)}`, `rank ${String(group.rank)}`];
  if (group.nilpotent) parts.push(`class ${String(group.nilpotencyClass)}`);
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
 * The left panel's list. Every match is rendered: 402 rows is well inside what
 * the browser will keep responsive, and the alternative costs scroll fidelity.
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
