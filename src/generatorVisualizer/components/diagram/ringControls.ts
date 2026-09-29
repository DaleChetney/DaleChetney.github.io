import { el } from "@shared/dom";

/** One orbit that can be split into concentric rings, and how it is split now. */
export interface RingSplit {
  /** The orbit's index, left to right. */
  orbit: number;
  /** Points in the orbit. */
  size: number;
  /** Concentric rings it is drawn as. */
  rings: number;
  /** Every ring count it can be drawn as, ascending. */
  counts: readonly number[];
}

export interface RingControlsView {
  /** More rings (`1`) or fewer (`-1`) were asked for on an orbit. */
  onStep: (orbit: number, step: 1 | -1) => void;
}

/**
 * An up/down stepper per splittable orbit: the ring count, with the buttons
 * that change it beside it in one box. A lone orbit needs no name; beside
 * others it is named by its size. An orbit that cannot be split has nothing to
 * offer and gets no stepper.
 */
export const renderRingControls = (
  splits: readonly RingSplit[],
  orbitCount: number,
  view: RingControlsView,
): DocumentFragment => {
  const fragment = document.createDocumentFragment();
  if (splits.length === 0) return fragment;

  fragment.append(el("h2", {}, ["Rings"]));
  for (const split of splits) {
    const name = orbitCount > 1 ? `Orbit of ${String(split.size)}` : null;
    const at = split.counts.indexOf(split.rings);

    const button = (step: 1 | -1, symbol: string, label: string, enabled: boolean) => {
      const node = el("button", { className: "ring-step", type: "button", disabled: !enabled }, [
        symbol,
      ]);
      node.dataset.orbit = String(split.orbit);
      node.dataset.step = String(step);
      node.setAttribute("aria-label", name === null ? label : `${label}: ${name}`);
      node.addEventListener("click", () => {
        view.onStep(split.orbit, step);
      });
      return node;
    };

    const stepper = el("div", { className: "ring-stepper" }, [
      el("output", { className: "ring-count" }, [String(split.rings)]),
      el("span", { className: "ring-steps" }, [
        button(1, "▲", "More rings", at < split.counts.length - 1),
        button(-1, "▼", "Fewer rings", at > 0),
      ]),
    ]);
    const row = el("div", { className: "ring-control" }, [
      ...(name === null ? [] : [el("span", { className: "ring-name" }, [name])]),
      stepper,
    ]);
    row.dataset.orbit = String(split.orbit);
    fragment.append(row);
  }
  return fragment;
};
