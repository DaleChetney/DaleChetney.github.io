import { mount, preservingFocus, qs } from "@shared/dom";
import type { CatalogueGroup } from "./catalogue";
import { filterGroups, groupListCaption, renderGroupList } from "./components/group-list";

/** Group rows are identified by their label, which outlives a redraw. */
const rowFocus = (active: Element): string | null => {
  const row = active.closest(".group-row[data-label]")?.getAttribute("data-label");
  return row == null ? null : `.group-row[data-label="${row}"]`;
};

/**
 * The left panel: the whole catalogue, filtered by the search box.
 *
 * It owns the query, because nothing else on the page has any use for it, and
 * re-renders itself on every keystroke. Choosing a group is the one thing it
 * reports outwards; it does not know what happens next.
 *
 * Deliberately off the selection path: 526 rows is a lot to rebuild, and none
 * of them change when a generator is toggled.
 */
export class LeftPanel {
  readonly #groups: readonly CatalogueGroup[];
  readonly #onSelect: (label: string) => void;
  #query = "";
  #selected: string | null = null;

  constructor(groups: readonly CatalogueGroup[], onSelect: (label: string) => void) {
    this.#groups = groups;
    this.#onSelect = onSelect;
    qs<HTMLInputElement>("#group-search").addEventListener("input", (event) => {
      this.#query = (event.currentTarget as HTMLInputElement).value;
      this.#draw();
    });
  }

  /** Draw the list, marking `selected` as the group on screen. */
  show(selected: string): void {
    this.#selected = selected;
    this.#draw();
  }

  #draw(): void {
    const matches = filterGroups(this.#groups, this.#query);
    qs("#group-count").textContent = groupListCaption(matches.length, this.#groups.length);
    preservingFocus(rowFocus, () => {
      mount(
        qs("#group-list"),
        renderGroupList(matches, { selected: this.#selected, onSelect: this.#onSelect }),
      );
    });
  }
}
