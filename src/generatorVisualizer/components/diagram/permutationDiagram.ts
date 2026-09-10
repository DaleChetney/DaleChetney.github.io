import { svg } from "../../svg";
import { arrowheadDefs, renderArrows, type ActionArrow } from "./arrow";
import { renderNode, type PlacedPoint } from "./node";

/** Placed points and the canvas they were placed on. */
export interface Diagram {
  points: PlacedPoint[];
  width: number;
  height: number;
}

/**
 * Render the diagram: one node per point of the permutation domain, plus an
 * arrow `p -> g(p)` for each moved point of each selected generator. Colours
 * come from the caller, which knows how many generators are being drawn and can
 * therefore spread them.
 */
export const renderPermutationDiagram = (
  diagram: Diagram,
  arrows: readonly ActionArrow[],
  colourOf: (generator: number) => string,
): SVGSVGElement => {
  const root = svg("svg", {
    viewBox: `0 0 ${diagram.width} ${diagram.height}`,
    width: diagram.width,
    height: diagram.height,
    class: "diagram",
    role: "img",
  });

  root.append(arrowheadDefs(arrows, colourOf), renderArrows(arrows, colourOf));

  const nodes = svg("g", { class: "nodes" });
  for (const placed of diagram.points) nodes.append(renderNode(placed));
  root.append(nodes);

  return root;
};
