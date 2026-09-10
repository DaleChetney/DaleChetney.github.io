import { svg } from "../../svg";

/** A point of the permutation domain, placed in diagram coordinates. */
export interface PlacedPoint {
  point: number;
  x: number;
  y: number;
}

export const NODE_RADIUS = 17;

/** Clearance left between the circles of two neighbours on a ring. */
const RING_PADDING = 13;

/** Closest two neighbours on a ring are ever drawn, as arc length. */
export const MIN_NODE_SPACING = NODE_RADIUS * 2 + RING_PADDING;

/** One node of the diagram: a circle carrying the point it stands for. */
export const renderNode = (placed: PlacedPoint): SVGGElement => {
  const group = svg("g", { class: "node", "data-point": placed.point });
  group.append(svg("circle", { cx: placed.x, cy: placed.y, r: NODE_RADIUS }));

  const label = svg("text", {
    x: placed.x,
    y: placed.y,
    "text-anchor": "middle",
    "dominant-baseline": "central",
  });
  label.textContent = String(placed.point);
  group.append(label);

  return group;
};
