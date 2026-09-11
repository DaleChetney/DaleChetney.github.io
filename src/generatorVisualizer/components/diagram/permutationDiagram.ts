import { svg } from "../../svg";
import { arrowheadDefs, renderArrows, type ActionArrow } from "./arrow";
import { renderNode, type PlacedPoint } from "./node";

/** Placed points and the canvas they were placed on. */
export interface Diagram {
  points: PlacedPoint[];
  width: number;
  height: number;
}

export interface DiagramView {
  /** The point picked to be swapped, waiting on a second; null while none is. */
  picked: number | null;
  /** A node was clicked: pick it, or swap it with the one already picked. */
  onPick: (point: number) => void;
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
    node.addEventListener("click", () => {
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

  root.append(arrowheadDefs(arrows, colorOf), renderArrows(arrows, colorOf));

  return root;
};
