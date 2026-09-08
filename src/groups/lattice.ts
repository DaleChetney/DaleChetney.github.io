import type { SubgroupClass, SubgroupLattice } from "@shared/subgroups";
import { svg } from "./svg";

export interface LatticeNode {
  /** Index into `SubgroupLattice.classes`. */
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
  width: number;
  height: number;
}

const COLUMN_WIDTH = 104;
const LEVEL_HEIGHT = 62;
const MARGIN_X = 20;
const MARGIN_Y = 26;
/** Gap left between a cover line and the label at each end. */
const LABEL_GAP = 13;

const SUBSCRIPT_DIGITS = "₀₁₂₃₄₅₆₇₈₉";

const subscript = (n: number): string =>
  String(n)
    .split("")
    .map((digit) => SUBSCRIPT_DIGITS[Number(digit)])
    .join("");

/**
 * A class's label. Cyclic subgroups are named `C_n`; the whole group takes the
 * group's own name. Anything else shows only its order, since naming it needs
 * LMFDB's `subgroup_tex` and this lattice is computed rather than baked.
 * A class with conjugates carries their count as a left subscript, as LMFDB does.
 */
export const classLabel = (
  subgroupClass: SubgroupClass,
  wholeOrder: number,
  wholeName: string,
): string => {
  const base =
    subgroupClass.order === wholeOrder
      ? wholeName
      : subgroupClass.cyclic
        ? `C${subscript(subgroupClass.order)}`
        : String(subgroupClass.order);
  return subgroupClass.count > 1 ? `${subscript(subgroupClass.count)}${base}` : base;
};

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

  return { nodes, edges, width, height };
};

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
  /** Node indices that would complete the selection into a generating set. */
  completing: ReadonlySet<number>;
  onToggle: (nodeIndex: number) => void;
}

/**
 * Render the lattice. A node carries the colour of the first generator chosen
 * from it, so the lattice and the main diagram read as one selection.
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
