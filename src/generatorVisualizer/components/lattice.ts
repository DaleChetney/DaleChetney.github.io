import type { SubgroupLattice } from "@shared/mathUtils/groups/subgroupLattice";
import { classLabel } from "./classLabel";
import { svg } from "../svg";

export interface LatticeNode {
  /** Index into `SubgroupLattice.classes`. */
  index: number;
  label: string;
  x: number;
  y: number;
  /** Only cyclic subgroups above the trivial one pick out a generator. */
  selectable: boolean;
  /** The group itself, at the top: what the selection is trying to generate. */
  whole: boolean;
}

export interface LatticeDiagram {
  nodes: LatticeNode[];
  /** Cover relations, as `[upperNodeIndex, lowerNodeIndex]` into `nodes`. */
  edges: [number, number][];
  /** Nodes in the widest level, which is what sets the diagram's width. */
  columns: number;
  width: number;
  height: number;
}

const COLUMN_WIDTH = 104;
const LEVEL_HEIGHT = 62;
const MARGIN_X = 20;
const MARGIN_Y = 26;
/** Gap left between a cover line and the label at each end. */
const LABEL_GAP = 13;

/**
 * Lay the classes out as a Hasse diagram, one row per level, the trivial
 * subgroup at the bottom. Rows are ordered by subgroup order ascending, which
 * reproduces LMFDB's own left-to-right arrangement for these groups.
 */
export const layoutLattice = (
  lattice: SubgroupLattice,
  wholeOrder: number,
  wholeName: string,
): LatticeDiagram => {
  const levels = [...new Set(lattice.classes.map((c) => c.level))].sort((a, b) => a - b);
  const widest = Math.max(
    ...levels.map((level) => lattice.classes.filter((c) => c.level === level).length),
  );

  const width = widest * COLUMN_WIDTH + MARGIN_X * 2;
  const height = (levels.length - 1) * LEVEL_HEIGHT + MARGIN_Y * 2;

  const nodes: LatticeNode[] = [];
  for (const level of levels) {
    const row = lattice.classes
      .map((subgroupClass, index) => ({ subgroupClass, index }))
      .filter((entry) => entry.subgroupClass.level === level)
      .sort((a, b) => a.subgroupClass.order - b.subgroupClass.order);
    const step = width / (row.length + 1);
    row.forEach((entry, column) => {
      nodes.push({
        index: entry.index,
        label: classLabel(entry.subgroupClass, wholeOrder, wholeName),
        x: step * (column + 1),
        // Level 0 sits at the bottom, so higher levels get smaller y.
        y: height - MARGIN_Y - level * LEVEL_HEIGHT,
        selectable: entry.subgroupClass.cyclic && entry.subgroupClass.order > 1,
        whole: entry.subgroupClass.order === wholeOrder,
      });
    });
  }

  const nodeByClass = new Map(nodes.map((node, i) => [node.index, i]));
  const edges: [number, number][] = [];
  lattice.covers.forEach((lowers, upper) => {
    for (const lower of lowers) {
      const a = nodeByClass.get(upper);
      const b = nodeByClass.get(lower);
      if (a !== undefined && b !== undefined) edges.push([a, b]);
    }
  });

  return { nodes, edges, columns: widest, width, height };
};

/**
 * The layout width that earns the lattice its whole allowance on the page.
 *
 * A diagram this wide is drawn at the full 60% the panel gives it, and every
 * narrower one is drawn at the same scale rather than stretched to fill — so a
 * lattice of two nodes has the same size nodes as a lattice of ten, and only a
 * wider one is shrunk to fit. Ten columns is the calibration point because that
 * is the size the nodes already read well at.
 */
const LATTICE_REFERENCE_WIDTH = 10 * COLUMN_WIDTH + MARGIN_X * 2;

/** How much of its allowance a lattice of this layout width should take. */
const latticeWidthShare = (width: number): number => Math.min(1, width / LATTICE_REFERENCE_WIDTH);

/** Shorten a cover line at both ends so it does not run into the labels. */
const trimmedLine = (
  from: LatticeNode,
  to: LatticeNode,
): { x1: number; y1: number; x2: number; y2: number } => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = (dx / length) * LABEL_GAP;
  const uy = (dy / length) * LABEL_GAP;
  return { x1: from.x + ux, y1: from.y + uy, x2: to.x - ux, y2: to.y - uy };
};

export interface LatticeView {
  /** Node indices currently chosen as generators. */
  selected: ReadonlySet<number>;
  /** Node indices offering an element that would complete the selection into a generating set. */
  completing: ReadonlySet<number>;
  /** Whether the selection generates the whole group. */
  complete: boolean;
  onToggle: (nodeIndex: number) => void;
}

/**
 * Render the lattice. A node carries the colour of the first generator chosen
 * from it, so the lattice and the main diagram read as one selection. The
 * completing nodes are outlined, and so is the whole group once it is generated:
 * the outline is the one thing on the page that reads as a state of the selection.
 */
export const renderLattice = (
  diagram: LatticeDiagram,
  view: LatticeView,
  nodeColour: (nodeIndex: number) => string | null,
): SVGSVGElement => {
  const root = svg("svg", {
    viewBox: `0 0 ${diagram.width} ${diagram.height}`,
    width: diagram.width,
    height: diagram.height,
    class: "lattice",
    role: "group",
  });
  // Width as a share of the allowance rather than all of it: the scale, and so
  // the size of a node, is then the same whatever the lattice looks like.
  root.style.width = `${(latticeWidthShare(diagram.width) * 100).toFixed(2)}%`;

  const lines = svg("g", { class: "lattice-edges" });
  for (const [upper, lower] of diagram.edges) {
    lines.append(svg("line", trimmedLine(diagram.nodes[upper], diagram.nodes[lower])));
  }
  root.append(lines);

  for (const node of diagram.nodes) {
    const selected = view.selected.has(node.index);
    const completing = view.completing.has(node.index);
    const group = svg("g", {
      class: [
        "lattice-node",
        node.selectable ? "selectable" : "fixed",
        selected ? "selected" : "",
        completing ? "completing" : "",
        node.whole && view.complete ? "complete" : "",
      ]
        .filter(Boolean)
        .join(" "),
      "data-class": node.index,
    });

    const label = svg("text", {
      x: node.x,
      y: node.y,
      "text-anchor": "middle",
      "dominant-baseline": "central",
    });
    label.textContent = node.label;
    const colour = nodeColour(node.index);
    if (colour !== null) label.setAttribute("fill", colour);

    // A transparent pill behind the label gives the node a usable hit area and
    // somewhere for the selected and completing styles to land.
    group.append(
      svg("rect", {
        x: node.x - 34,
        y: node.y - 15,
        width: 68,
        height: 30,
        rx: 15,
      }),
      label,
    );

    if (node.selectable) {
      group.setAttribute("tabindex", "0");
      group.setAttribute("role", "button");
      group.setAttribute("aria-pressed", String(selected));
      group.addEventListener("click", () => {
        view.onToggle(node.index);
      });
      group.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        view.onToggle(node.index);
      });
    }

    root.append(group);
  }

  return root;
};
