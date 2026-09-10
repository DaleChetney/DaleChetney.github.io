import { el } from "@shared/dom";
import type { CatalogueRepresentation } from "../catalogue";

export interface RepresentationView {
  selected: string;
  onSelect: (id: string) => void;
}

/**
 * The button's text. A transitive representation has LMFDB's `nTt` label, which
 * is worth showing as it is; the minimal faithful one has only `perm-<degree>`,
 * which is an id rather than a name.
 */
export const representationLabel = (representation: CatalogueRepresentation): string =>
  representation.id.startsWith("perm-")
    ? `degree ${String(representation.degree)}`
    : representation.id;

/**
 * The representations on offer, under the group name.
 *
 * This is a row rather than a tab because half the groups in the catalogue have
 * no transitive representation at all — a tab that is empty as often as not is
 * worse than a row that is sometimes one item long.
 */
export const renderRepresentationRow = (
  representations: readonly CatalogueRepresentation[],
  view: RepresentationView,
): HTMLElement => {
  const row = el("div", { className: "representation-row" });
  for (const representation of representations) {
    const button = el("button", { className: "representation", type: "button" }, [
      representationLabel(representation),
    ]);
    button.dataset.representation = representation.id;
    button.title = representation.title;
    const selected = representation.id === view.selected;
    button.setAttribute("aria-pressed", String(selected));
    if (selected) button.classList.add("selected");
    button.addEventListener("click", () => {
      view.onSelect(representation.id);
    });
    row.append(button);
  }
  return row;
};
