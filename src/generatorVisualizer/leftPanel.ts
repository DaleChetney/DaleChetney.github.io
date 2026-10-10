import { mount, preservingFocus, qs } from "@shared/dom";
import type { CatalogueGroup } from "./catalogue";
import { categoryOptions, filterGroups, renderFilterOptions } from "./components/groupCategories";
import { groupListCaption, renderGroupList } from "./components/group-list";
import { GroupSorter, type GroupSort } from "./components/groupSorter";

/** Group rows are identified by their label, which outlives a redraw. */
const rowFocus = (active: Element): string | null => {
  const row = active.closest(".group-row[data-label]")?.getAttribute("data-label");
  return row == null ? null : `.group-row[data-label="${row}"]`;
};

/**
 * The left panel: the whole catalogue, filtered by category and sorted
 * by whichever of `GroupSorter`'s keys was chosen last.
 *
 * It owns the chosen category and the list's current order, because nothing else on the page has any
 * use for them, and re-renders itself whenever either dropdown changes.
 * Choosing a group is the one thing it reports outwards; it does not know what
 * happens next.
 *
 * Deliberately off the selection path, since nothing here changes when a generator is toggled.
 */
export class LeftPanel {
  /** The whole catalogue in its current order. */
  readonly #sorter: GroupSorter;
  readonly #onSelect: (label: string) => void;
  /** A `GROUP_CATEGORIES` code, or `null` for every group. */
  #category: number | null = null;
  #selected: string | null = null;

  constructor(groups: readonly CatalogueGroup[], onSelect: (label: string) => void) {
    this.#sorter = new GroupSorter(groups);
    this.#onSelect = onSelect;
    const filter = qs<HTMLSelectElement>("#group-filter");
    filter.replaceChildren(...renderFilterOptions(categoryOptions(groups)));
    filter.addEventListener("change", (event) => {
      const value = (event.currentTarget as HTMLSelectElement).value;
      this.#category = value === "" ? null : Number(value);
      this.#draw();
    });
    const sort = qs<HTMLSelectElement>("#group-sort");
    sort.replaceChildren(...GroupSorter.renderOptions());
    sort.addEventListener("change", (event) => {
      const value = (event.currentTarget as HTMLSelectElement).value as GroupSort;
      this.#sorter.sortBy(value);
      this.#draw();
    });
  }

  /** Draw the list, marking `selected` as the group on screen. */
  show(selected: string): void {
    this.#selected = selected;
    this.#draw();
  }

  #draw(): void {
    const groups = this.#sorter.groups;
    const matches = filterGroups(groups, this.#category);
    qs("#group-count").textContent = groupListCaption(matches.length, groups.length);
    preservingFocus(rowFocus, () => {
      mount(
        qs("#group-list"),
        renderGroupList(matches, { selected: this.#selected, onSelect: this.#onSelect }),
      );
    });
  }
}
