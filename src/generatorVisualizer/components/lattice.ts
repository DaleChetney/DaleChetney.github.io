import { primeDivisorCount } from "@shared/mathUtils/math";
import type { CatalogueSubgroupClass } from "../catalogue";
import { classLabel } from "./classLabel";
import { svg } from "../svg";

export interface LatticeNode {
  /** Index into the group's subgroup classes. */
  index: number;
  label: string;
  x: number;
  y: number;
  /** Only cyclic subgroups above the trivial one pick out a generator. */
  selectable: boolean;
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

const COLUMN_WIDTH = 94;
const LEVEL_HEIGHT = 62;
const MARGIN_X = 20;
const MARGIN_Y = 26;
/** Gap left between a cover line and the label at each end. */
const LABEL_GAP = 13;

/**
 * Lay the classes out as a Hasse diagram, one row per level, the trivial
 * subgroup at the bottom. A class's level is the number of prime divisors of
 * its order counted with multiplicity, which is the vertical axis LMFDB's own
 * diagram uses; rows are ordered by subgroup order ascending, which
 * reproduces its left-to-right arrangement for these groups.
 */
export const layoutLattice = (
  classes: readonly CatalogueSubgroupClass[],
  wholeOrder: number,
  wholeName: string,
): LatticeDiagram => {
  const levelOf = classes.map((c) => primeDivisorCount(c.order));
  const levels = [...new Set(levelOf)].sort((a, b) => a - b);
  const widest = Math.max(...levels.map((level) => levelOf.filter((l) => l === level).length));

  const width = widest * COLUMN_WIDTH + MARGIN_X * 2;
  const height = (levels.length - 1) * LEVEL_HEIGHT + MARGIN_Y * 2;

  const nodes: LatticeNode[] = [];
  for (const level of levels) {
    const row = classes
      .map((subgroupClass, index) => ({ subgroupClass, index }))
      .filter((entry) => levelOf[entry.index] === level)
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
      });
    });
  }

  const nodeByClass = new Map(nodes.map((node, i) => [node.index, i]));
  const edges: [number, number][] = [];
  classes.forEach((subgroupClass, upper) => {
    for (const lower of subgroupClass.covers) {
      const a = nodeByClass.get(upper);
      const b = nodeByClass.get(lower);
      if (a !== undefined && b !== undefined) edges.push([a, b]);
    }
  });

  return { nodes, edges, columns: widest, width, height };
};

/** The layout width of a lattice this many columns wide, margins included. */
const columnsWidth = (columns: number): number => columns * COLUMN_WIDTH + MARGIN_X * 2;

/**
 * How wide a lattice must be laid out to earn its whole allowance on the
 * page, on a wide screen and on a phone.
 *
 * A diagram this wide is drawn at the full allowance — 75% of the panel on a
 * wide screen, all of it on a phone — and every narrower one is drawn at the
 * same scale rather than stretched to fill, so a lattice of two nodes has the
 * same size nodes as a wider one, and only one wider still is shrunk to fit.
 *
 * On a wide screen the nodes read well at the size a ten-column lattice has
 * across 60% of the panel. The allowance is wider than that, as room to grow,
 * so the lattice that fills it is wider in proportion: about twelve and a half
 * columns. Across a phone they read well at three columns to the panel.
 */
const WIDE_REFERENCE_WIDTH = columnsWidth(10) * (0.75 / 0.6);
const NARROW_REFERENCE_WIDTH = columnsWidth(3);

/**
 * How much of its allowance a lattice of this layout width should take, when
 * one `reference` wide would take all of it. The margins count on both sides,
 * so a narrower lattice's nodes come out the size the reference's do.
 */
const latticeWidthShare = (width: number, reference: number): number =>
  Math.min(1, width / reference);

const percent = (share: number): string => `${(share * 100).toFixed(2)}%`;

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
  /** Node indices whose chosen elements generate the whole group; empty until they do. */
  generating: ReadonlySet<number>;
  /** The node of the join of the selected subgroups, or null while nothing is chosen. */
  joinOfSelected: number | null;
  /** Node indices at or below `joinOfSelected`: the sublattice generated so far. */
  generated: ReadonlySet<number>;
  onToggle: (nodeIndex: number) => void;
}

/**
 * Render the lattice. The node the selection generates is outlined and the
 * covers beneath it are drawn in the same color, so the generated sublattice
 * reads as a subdiagram hanging from it. The completing nodes are outlined too,
 * dashed, and once the group is generated so are the classes that did it.
 */
export const renderLattice = (diagram: LatticeDiagram, view: LatticeView): SVGSVGElement => {
  const root = svg("svg", {
    viewBox: `0 0 ${diagram.width} ${diagram.height}`,
    width: diagram.width,
    height: diagram.height,
    class: "lattice",
    role: "group",
  });
  // Width as a share of the allowance rather than all of it: the scale, and so
  // the size of a node, is then the same whatever the lattice looks like. Both
  // shares are offered, and the stylesheet takes the one the screen calls for.
  root.style.setProperty(
    "--wide-share",
    percent(latticeWidthShare(diagram.width, WIDE_REFERENCE_WIDTH)),
  );
  root.style.setProperty(
    "--narrow-share",
    percent(latticeWidthShare(diagram.width, NARROW_REFERENCE_WIDTH)),
  );

  const lines = svg("g", { class: "lattice-edges" });
  for (const [upper, lower] of diagram.edges) {
    const line = svg("line", trimmedLine(diagram.nodes[upper], diagram.nodes[lower]));
    // A cover with both ends inside the down-set lies inside the generated
    // sublattice; one leaving it does not.
    if (
      view.generated.has(diagram.nodes[upper].index) &&
      view.generated.has(diagram.nodes[lower].index)
    ) {
      line.classList.add("generated");
    }
    lines.append(line);
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
        view.joinOfSelected === node.index ? "generated" : "",
        view.generating.has(node.index) ? "generating" : "",
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

    // A transparent pill behind the label gives the node a usable hit area and
    // somewhere for the selected and completing styles to land.
    group.append(
      svg("rect", {
        x: node.x - 28,
        y: node.y - 15,
        width: 56,
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
