import { el } from "@shared/dom";
import type { CatalogueGroup } from "../catalogue";

export interface GroupListView {
  selected: string | null;
  onSelect: (label: string) => void;
}

/**
 * Groups matching every whitespace-separated term of `query`.
 *
 * A term matches on the label, the ASCII name or the rendered name, so both
 * `32.13` and `c8:c4` find the same group — the second of which is three
 * groups, since a display name does not identify one.
 */
export const filterGroups = (
  groups: readonly CatalogueGroup[],
  query: string,
): CatalogueGroup[] => {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [...groups];
  return groups.filter((group) => {
    const haystack = `${group.label} ${group.name} ${group.displayName}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
};

const groupRow = (group: CatalogueGroup, view: GroupListView): HTMLElement => {
  const row = el("button", { className: "group-row", type: "button" }, [
    el("span", { className: "group-name" }, [group.displayName]),
    el("span", { className: "group-meta" }, [`${group.label} · order ${String(group.order)}`]),
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
 * The left panel's list. Every match is rendered: 526 rows is well inside what
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

/** `526 groups` or `3 of 526 groups`, for the caption above the list. */
export const groupListCaption = (shown: number, total: number): string =>
  shown === total
    ? `${String(total)} groups`
    : `${String(shown)} of ${String(total)} group${total === 1 ? "" : "s"}`;
