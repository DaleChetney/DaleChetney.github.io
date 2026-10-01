import { el } from "@shared/dom";
import { svg } from "../../svg";

/**
 * One orbit, how it is split into concentric rings now, whether a node sits at
 * its center, and whether its nodes are locked.
 */
export interface RingSplit {
  /** The orbit's index, left to right. */
  orbit: number;
  /** Points in the orbit. */
  size: number;
  /** Concentric rings it is drawn as. */
  rings: number;
  /** Every ring count it can be drawn as, ascending, with its center as it is. */
  counts: readonly number[];
  /** Whether one of its nodes sits at its center, the rest ringed around it. */
  centered: boolean;
  /** Whether it has nodes enough to ring the rest around one at its center. */
  centerable: boolean;
  /** Whether its rings are turning. */
  playing: boolean;
  /** Whether its nodes are held to its rings, rather than free to be dragged anywhere. */
  locked: boolean;
}

export interface RingControlsView {
  /** More rings (`1`) or fewer (`-1`) were asked for on an orbit. */
  onStep: (orbit: number, step: 1 | -1) => void;
  /** An orbit's rings were asked to start turning, or to stop. */
  onTogglePlay: (orbit: number) => void;
  /** An orbit's nodes were asked to be unlocked, or locked again. */
  onToggleLock: (orbit: number) => void;
  /** A node was asked to be put at an orbit's center, or back on its rings. */
  onToggleCenter: (orbit: number) => void;
}

/** A padlock, its shackle closed or swung open, drawn in the text color. */
const padlock = (locked: boolean): SVGSVGElement => {
  const icon = svg("svg", { viewBox: "0 0 16 16", width: 16, height: 16, "aria-hidden": "true" });
  icon.append(
    svg("path", {
      d: locked ? "M5 7V5a3 3 0 0 1 6 0v2" : "M5 7V5a3 3 0 0 1 6 0",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 1.6,
    }),
    svg("rect", { x: 3, y: 7, width: 10, height: 7, rx: 1.2, fill: "currentColor" }),
  );
  return icon;
};

/** A bullseye while a node sits at the center, an empty circle while none does. */
const bullseye = (centered: boolean): SVGSVGElement => {
  const icon = svg("svg", { viewBox: "0 0 16 16", width: 16, height: 16, "aria-hidden": "true" });
  icon.append(
    svg("circle", {
      cx: 8,
      cy: 8,
      r: 6,
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 1.6,
    }),
  );
  if (centered) icon.append(svg("circle", { cx: 8, cy: 8, r: 2.5, fill: "currentColor" }));
  return icon;
};

/** Name a control for a screen reader, and give it the same name as a tooltip. */
const label = (node: HTMLElement, text: string): void => {
  node.setAttribute("aria-label", text);
  node.title = text;
};

/** What the count stands for: how many rings, of how many nodes, around what. */
const describeSplit = ({ size, rings, centered }: RingSplit): string => {
  const perRing = (size - (centered ? 1 : 0)) / rings;
  const split = `${String(rings)} ${rings === 1 ? "ring" : "rings"} of ${String(perRing)}`;
  return centered ? `${split}, around a center node` : split;
};

/**
 * A stepper per orbit, all in one box: a lock that frees its nodes to be
 * dragged anywhere, a play/pause button that sets its rings turning, a button
 * that puts one node at its center, the ring count, and the buttons that change
 * the count. Every one of them names itself in a tooltip. A lone orbit needs no name;
 * beside others it is named by its size. An unlocked orbit has no rings to
 * turn, so it cannot be played.
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
    const named = (label: string): string => (name === null ? label : `${label}: ${name}`);
    const at = split.counts.indexOf(split.rings);

    const button = (step: 1 | -1, symbol: string, text: string, enabled: boolean) => {
      const node = el("button", { className: "ring-step", type: "button", disabled: !enabled }, [
        symbol,
      ]);
      node.dataset.orbit = String(split.orbit);
      node.dataset.step = String(step);
      label(node, named(text));
      node.addEventListener("click", () => {
        view.onStep(split.orbit, step);
      });
      return node;
    };

    const lock = el("button", { className: "ring-lock", type: "button" }, [padlock(split.locked)]);
    lock.dataset.orbit = String(split.orbit);
    label(lock, named(split.locked ? "Unlock nodes" : "Lock nodes"));
    lock.setAttribute("aria-pressed", String(!split.locked));
    lock.addEventListener("click", () => {
      view.onToggleLock(split.orbit);
    });

    // The text presentation selector keeps the glyph from being drawn as an emoji.
    const play = el("button", { className: "ring-play", type: "button", disabled: !split.locked }, [
      split.playing ? "❚❚" : "▶︎",
    ]);
    play.dataset.orbit = String(split.orbit);
    label(play, named(split.playing ? "Pause rotation" : "Play rotation"));
    play.setAttribute("aria-pressed", String(split.playing));
    play.addEventListener("click", () => {
      view.onTogglePlay(split.orbit);
    });

    const center = el(
      "button",
      { className: "ring-center", type: "button", disabled: !split.centerable },
      [bullseye(split.centered)],
    );
    center.dataset.orbit = String(split.orbit);
    label(center, named(split.centered ? "Remove center node" : "Add center node"));
    center.setAttribute("aria-pressed", String(split.centered));
    center.addEventListener("click", () => {
      view.onToggleCenter(split.orbit);
    });

    const count = el("output", { className: "ring-count" }, [String(split.rings)]);
    count.title = describeSplit(split);

    const stepper = el("div", { className: "ring-stepper" }, [
      lock,
      play,
      center,
      count,
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
