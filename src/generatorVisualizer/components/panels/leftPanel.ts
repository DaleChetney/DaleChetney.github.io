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

const STORAGE_KEY = "generatorVisualizer.listOptions";

/** The filter and sort the reader last chose for the list, as stored. */
interface ListOptions {
  /** A `GROUP_CATEGORIES` code, or `null` for every group. */
  category: number | null;
  /** The sort last chosen, or `null` if none has been. */
  sort: GroupSort | null;
}

/**
 * The options last saved, with anything not of the right shape read as not
 * chosen. A sort that no longer exists reads as none; whether the category
 * still has an option is for the dropdown to say.
 */
const loadListOptions = (): ListOptions => {
  const stored: unknown = load(STORAGE_KEY, null);
  if (typeof stored !== "object" || stored === null) return { category: null, sort: null };
  const { category, sort } = stored as Partial<Record<keyof ListOptions, unknown>>;
  return {
    category: typeof category === "number" ? category : null,
    sort: GroupSorter.isValidSortingOption(sort) ? sort : null,
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
    const stored = loadListOptions();
    this.#sort = stored.sort;
    if (this.#sort !== null) this.#sorter.sortBy(this.#sort);

    const filter = qs<HTMLSelectElement>("#group-filter");
    filter.replaceChildren(...renderFilterOptions(categoryOptions(groups)));
    filter.value = stored.category === null ? "" : String(stored.category);
    // A category no group falls in any more has no option, so the dropdown
    // refuses it; the list then shows every group, as the dropdown does.
    this.#category = filter.value === "" ? null : stored.category;
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
    save<ListOptions>(STORAGE_KEY, {
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
