import { el } from "@shared/dom";
import { superscript } from "@shared/mathUtils/groups/tex";
import { primeFactorization } from "@shared/mathUtils/math";
import type { CatalogueGroup } from "../catalogue";

export interface GroupListView {
  selected: string | null;
  onSelect: (label: string) => void;
}

/** `2³·3²·5` for 360; a prime or 1 is just itself. */
export const factorizationText = (n: number): string =>
  primeFactorization(n)
    .map(([prime, exponent]) => String(prime) + (exponent === 1 ? "" : superscript(exponent)))
    .join("·") || String(n);

/**
 * `12.1 · order 2²·3`, plus whichever of abelian, the nilpotency class or the
 * derived length is the finest that applies. Non-solvable groups get none.
 */
const groupMeta = (group: CatalogueGroup): string => {
  const parts = [group.label, `order ${factorizationText(group.order)}`];
  if (group.abelian) {
    parts.push(`abelian`);
  } else if (group.nilpotent) {
    parts.push(`nilpotency ${String(group.nilpotencyClass)}`);
  } else if (group.solvable) {
    parts.push(`derived length ${String(group.derivedLength)}`);
  }
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
