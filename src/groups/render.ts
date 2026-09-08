import type { ActionArrow, Diagram } from "./layout";
import { arrowStrokeWidths, NODE_RADIUS } from "./layout";
import { svg } from "./svg";

/** How far an arrow bows away from the straight chord, in user units. */
const bowOffset = (distance: number): number => Math.min(distance * 0.18, 34) + 6;

const arrowheadId = (generator: number): string => `arrowhead-${generator}`;

/**
 * A quadratic curve from one node's boundary to another's. Arrows bow to one
 * side so that a 2-cycle's two arrows separate instead of overlapping, and both
 * ends are pulled back to the node boundary so the head is not hidden under it.
 */
const arrowPath = (arrow: ActionArrow): string => {
  const dx = arrow.to.x - arrow.from.x;
  const dy = arrow.to.y - arrow.from.y;
  const distance = Math.hypot(dx, dy) || 1;
  const offset = bowOffset(distance);
  const controlX = (arrow.from.x + arrow.to.x) / 2 - (dy / distance) * offset;
  const controlY = (arrow.from.y + arrow.to.y) / 2 + (dx / distance) * offset;

  const pullBack = (node: { x: number; y: number }, gap: number): { x: number; y: number } => {
    const toControlX = controlX - node.x;
    const toControlY = controlY - node.y;
    const length = Math.hypot(toControlX, toControlY) || 1;
    return {
      x: node.x + (toControlX / length) * gap,
      y: node.y + (toControlY / length) * gap,
    };
  };

  const start = pullBack(arrow.from, NODE_RADIUS + 2);
  const end = pullBack(arrow.to, NODE_RADIUS + 8);
  return `M ${start.x} ${start.y} Q ${controlX} ${controlY} ${end.x} ${end.y}`;
};

const arrowheadMarker = (generator: number, colour: string): SVGMarkerElement => {
  const marker = svg("marker", {
    id: arrowheadId(generator),
    viewBox: "0 0 10 10",
    refX: 9,
    refY: 5,
    markerWidth: 5,
    markerHeight: 5,
    orient: "auto-start-reverse",
  });
  marker.append(svg("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: colour }));
  return marker;
};

/**
 * Render the diagram: one node per point of the permutation domain, plus an
 * arrow `p -> g(p)` for each moved point of each selected generator. Colours
 * come from the caller, which knows how many generators are being drawn and can
 * therefore spread them.
 */
export const renderDiagram = (
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

  const defs = svg("defs");
  for (const generator of new Set(arrows.map((arrow) => arrow.generator))) {
    defs.append(arrowheadMarker(generator, colourOf(generator)));
  }
  root.append(defs);

  const edges = svg("g", { class: "edges", fill: "none" });
  const widths = arrowStrokeWidths(arrows);
  // Widest first, so an arrow sharing a path is drawn over the ones behind it
  // rather than under them.
  const order = arrows.map((_, index) => index).sort((a, b) => widths[b] - widths[a]);
  for (const index of order) {
    const arrow = arrows[index];
    edges.append(
      svg("path", {
        d: arrowPath(arrow),
        stroke: colourOf(arrow.generator),
        "stroke-width": widths[index],
        "marker-end": `url(#${arrowheadId(arrow.generator)})`,
        "data-generator": arrow.generator,
        "data-from": arrow.from.point,
        "data-to": arrow.to.point,
      }),
    );
  }
  root.append(edges);

  const nodes = svg("g", { class: "nodes" });
  for (const placed of diagram.points) {
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
    nodes.append(group);
  }
  root.append(nodes);

  return root;
};
