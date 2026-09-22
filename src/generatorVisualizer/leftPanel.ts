import { mount, preservingFocus, qs } from "@shared/dom";
import type { CatalogueGroup } from "./catalogue";
import {
  filterGroups,
  groupListCaption,
  renderFilterOptions,
  renderGroupList,
  solvabilityOptions,
} from "./components/group-list";

/** Group rows are identified by their label, which outlives a redraw. */
const rowFocus = (active: Element): string | null => {
  const row = active.closest(".group-row[data-label]")?.getAttribute("data-label");
  return row == null ? null : `.group-row[data-label="${row}"]`;
};

/**
 * The left panel: the whole catalogue, filtered by solvability type.
 *
 * It owns the chosen type, because nothing else on the page has any use for
 * it, and re-renders itself whenever the dropdown changes. Choosing a group is
 * the one thing it reports outwards; it does not know what happens next.
 *
 * Deliberately off the selection path: 402 rows is a lot to rebuild, and none
 * of them change when a generator is toggled.
 */
export class LeftPanel {
  readonly #groups: readonly CatalogueGroup[];
  readonly #onSelect: (label: string) => void;
  /** LMFDB's solvability type code, or `null` for every group. */
  #type: number | null = null;
  #selected: string | null = null;

  constructor(groups: readonly CatalogueGroup[], onSelect: (label: string) => void) {
    this.#groups = groups;
    this.#onSelect = onSelect;
    const filter = qs<HTMLSelectElement>("#group-filter");
    filter.replaceChildren(...renderFilterOptions(solvabilityOptions(groups)));
    filter.addEventListener("change", (event) => {
      const value = (event.currentTarget as HTMLSelectElement).value;
      this.#type = value === "" ? null : Number(value);
      this.#draw();
    });
  }

  /** Draw the list, marking `selected` as the group on screen. */
  show(selected: string): void {
    this.#selected = selected;
    this.#draw();
  }

  #draw(): void {
    const matches = filterGroups(this.#groups, this.#type);
    qs("#group-count").textContent = groupListCaption(matches.length, this.#groups.length);
    preservingFocus(rowFocus, () => {
      mount(
        qs("#group-list"),
        renderGroupList(matches, { selected: this.#selected, onSelect: this.#onSelect }),
      );
    });
  }
}
