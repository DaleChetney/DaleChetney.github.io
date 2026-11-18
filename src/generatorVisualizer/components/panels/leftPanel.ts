import { mount, preservingFocus, qs } from "@shared/dom";
import { load, save } from "@shared/storage";
import type { CatalogueGroup } from "../../groupCatalogue/catalogue";
import {
  categoryOptions,
  filterGroups,
  renderFilterOptions,
} from "../../groupCatalogue/groupCategories";
import { groupListCaption, renderGroupList } from "../groupList";
import { GroupSorter, type GroupSort } from "../../groupCatalogue/groupSorter";

const STORAGE_KEY = "generatorVisualizer.groupList";

/** How the reader last left the list, as stored. */
interface StoredGroupList {
  /** A `GROUP_CATEGORIES` code, or `null` for every group. */
  category: number | null;
  /** The sort last chosen, or `null` if none has been. */
  sort: GroupSort | null;
}

/**
 * What was stored, keeping only what still makes sense: a category no group
 * falls in any more reads as every group, and a sort that no longer exists as
 * none chosen.
 */
const loadGroupList = (categories: ReadonlySet<number>): StoredGroupList => {
  const stored: unknown = load(STORAGE_KEY, null);
  if (typeof stored !== "object" || stored === null) return { category: null, sort: null };
  const { category, sort } = stored as Partial<Record<keyof StoredGroupList, unknown>>;
  return {
    category: typeof category === "number" && categories.has(category) ? category : null,
    sort: GroupSorter.isSort(sort) ? sort : null,
  };
};

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
 * use for them, and re-renders itself whenever either dropdown changes. Both
 * are remembered, so a reload opens the list as the reader left it.
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
  #category: number | null;
  /** The sort last chosen, or `null` for the catalogue's own order. */
  #sort: GroupSort | null;
  #selected: string | null = null;

  constructor(groups: readonly CatalogueGroup[], onSelect: (label: string) => void) {
    this.#sorter = new GroupSorter(groups);
    this.#onSelect = onSelect;
    const options = categoryOptions(groups);
    const stored = loadGroupList(new Set(options.map((option) => option.code)));
    this.#category = stored.category;
    this.#sort = stored.sort;
    if (this.#sort !== null) this.#sorter.sortBy(this.#sort);

    const filter = qs<HTMLSelectElement>("#group-filter");
    filter.replaceChildren(...renderFilterOptions(options));
    filter.value = this.#category === null ? "" : String(this.#category);
    filter.addEventListener("change", (event) => {
      const value = (event.currentTarget as HTMLSelectElement).value;
      this.#category = value === "" ? null : Number(value);
      this.#save();
      this.#draw();
    });
    const sort = qs<HTMLSelectElement>("#group-sort");
    sort.replaceChildren(...GroupSorter.renderOptions());
    if (this.#sort !== null) sort.value = this.#sort;
    sort.addEventListener("change", (event) => {
      const value = (event.currentTarget as HTMLSelectElement).value as GroupSort;
      this.#sort = value;
      this.#sorter.sortBy(value);
      this.#save();
      this.#draw();
    });
  }

  /** Draw the list, marking `selected` as the group on screen. */
  show(selected: string): void {
    this.#selected = selected;
    this.#draw();
  }

  #save(): void {
    save<StoredGroupList>(STORAGE_KEY, {
      category: this.#category,
      sort: this.#sort,
    });
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
