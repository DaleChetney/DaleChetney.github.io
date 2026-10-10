import { svg } from "../../svg";
import { arrowheadDefs, arrowPath, renderArrows, type ActionArrow, type BowWidth } from "./arrow";
import { holdToDrag } from "../../interactions/holdToDrag";
import { renderNode, type PlacedPoint } from "./node";

/** One concentric ring of an orbit, as placed: where it turns about, and what is on it. */
export interface PlacedRing {
  /** The orbit it belongs to, left to right. */
  orbit: number;
  /** Its place in the orbit, the outermost ring first. */
  ring: number;
  /** The centre it turns about, shared by every ring of its orbit. */
  cx: number;
  cy: number;
  radius: number;
  /** The points on it, in slot order. */
  points: readonly number[];
}

/** Placed points, the rings they were placed on, and the canvas. */
export interface Diagram {
  points: PlacedPoint[];
  rings: PlacedRing[];
  width: number;
  height: number;
}

export interface DiagramView {
  /** The point picked to be swapped, waiting on a second; null while none is. */
  picked: number | null;
  /** A node was clicked: pick it, or swap it with the one already picked. */
  onPick: (point: number) => void;
  /** How far the arrows bow, as a multiple of the usual amount; 1 when absent. */
  curvature?: number;
  /** How the arrows' bow grows with their length; "constant" when absent. */
  bowWidth?: BowWidth;
  /**
   * A node was held long enough to drag, with the pointer at these client
   * coordinates. Without it a node cannot be dragged, only clicked.
   */
  onDragStart?: (point: number, clientX: number, clientY: number) => void;
  /** The pointer moved during a drag. */
  onDragMove?: (clientX: number, clientY: number) => void;
  /** The drag ended. */
  onDragEnd?: () => void;
}

/**
 * Render the diagram: one node per point of the permutation domain, plus an
 * arrow `p -> g(p)` for each moved point of each selected generator. Colors
 * come from the caller, which knows how many generators are being drawn and can
 * therefore spread them.
 *
 * The arrows are drawn over the nodes rather than under them: an arrow can
 * pass behind a node it is not pointing at, and then where it ends is
 * anyone's guess, whereas no arrow ever covers a node.
 */
export const renderPermutationDiagram = (
  diagram: Diagram,
  arrows: readonly ActionArrow[],
  colorOf: (generator: number) => string,
  view: DiagramView,
): SVGSVGElement => {
  const root = svg("svg", {
    viewBox: `0 0 ${diagram.width} ${diagram.height}`,
    width: diagram.width,
    height: diagram.height,
    class: "diagram",
    role: "group",
  });

  const nodes = svg("g", { class: "nodes" });
  for (const placed of diagram.points) {
    const node = renderNode(placed);
    if (view.picked === placed.point) node.classList.add("picked");
    node.setAttribute("tabindex", "0");
    node.setAttribute("role", "button");
    node.setAttribute("aria-pressed", String(view.picked === placed.point));
    const hold = holdToDrag(node, {
      onStart: (x, y) => view.onDragStart?.(placed.point, x, y),
      onMove: (x, y) => view.onDragMove?.(x, y),
      onEnd: () => view.onDragEnd?.(),
    });
    node.addEventListener("click", () => {
      // A drag's release is not a click, and must not pick the node it let go of.
      if (hold.swallowClick()) return;
      view.onPick(placed.point);
    });
    node.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      view.onPick(placed.point);
    });
    nodes.append(node);
  }
  root.append(nodes);

  root.append(
    arrowheadDefs(arrows, colorOf),
    renderArrows(arrows, colorOf, view.curvature, view.bowWidth),
  );

  return root;
};

/**
 * Move a drawn diagram's nodes, and the arrows between them, to where `points`
 * places them. The elements themselves are kept, so this can run every frame
 * of an animation without dropping a click or the focus halfway through it.
 */
export const moveDiagram = (
  root: SVGSVGElement,
  points: readonly PlacedPoint[],
  curvature = 1,
  bowWidth: BowWidth = "constant",
): void => {
  const byPoint = new Map(points.map((placed) => [placed.point, placed]));
  for (const node of root.querySelectorAll<SVGGElement>(".node[data-point]")) {
    const placed = byPoint.get(Number(node.dataset.point));
    if (placed === undefined) continue;
    node.querySelector("circle")?.setAttribute("cx", String(placed.x));
    node.querySelector("circle")?.setAttribute("cy", String(placed.y));
    node.querySelector("text")?.setAttribute("x", String(placed.x));
    node.querySelector("text")?.setAttribute("y", String(placed.y));
  }
  for (const path of root.querySelectorAll<SVGPathElement>(".edges path")) {
    const from = byPoint.get(Number(path.dataset.from));
    const to = byPoint.get(Number(path.dataset.to));
    if (from === undefined || to === undefined) continue;
    path.setAttribute("d", arrowPath({ from, to }, curvature, bowWidth));
  }
};
