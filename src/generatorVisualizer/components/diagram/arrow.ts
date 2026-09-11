import type { Permutation } from "@shared/mathUtils/groups/permutations";
import { svg } from "../../svg";
import { NODE_RADIUS, type PlacedPoint } from "./node";

/** A generator's action on one point, as an edge between two placed points. */
export interface ActionArrow {
  /** Index into the representation's generator list. */
  generator: number;
  from: PlacedPoint;
  to: PlacedPoint;
}

/**
 * Arrows for the action of the generators being drawn, one per moved point.
 * Fixed points are skipped: an arrow from a node to itself carries no
 * information the node's absence of an arrow does not already give.
 */
export const actionArrows = (
  points: readonly PlacedPoint[],
  generators: readonly Permutation[],
): ActionArrow[] => {
  const byPoint = new Map(points.map((placed) => [placed.point, placed]));
  const arrows: ActionArrow[] = [];
  generators.forEach((generator, index) => {
    for (const placed of points) {
      const image = generator[placed.point - 1];
      if (image === placed.point) continue;
      const target = byPoint.get(image);
      if (target === undefined) continue;
      arrows.push({ generator: index, from: placed, to: target });
    }
  });
  return arrows;
};

/** Stroke width of an arrow that shares its path with no other. */
const ARROW_WIDTH = 2.2;

/** How much wider each further arrow on a shared path is drawn. */
const ARROW_WIDTH_STEP = 1.3;

/**
 * Stroke widths, aligned with `arrows`. Different generators can send the same
 * point to the same image, and those arrows trace the same curve exactly. Rather
 * than hide all but the last, the ones sharing a path are widened in steps so
 * that drawing widest-first leaves each visible as a band inside the one behind
 * it. The shared path is the honest picture: it really is one map, induced by
 * several generators.
 */
const strokeWidths = (arrows: readonly ActionArrow[]): number[] => {
  const pathKey = (arrow: ActionArrow): string => `${arrow.from.point}->${arrow.to.point}`;
  const bundles = new Map<string, number>();
  for (const arrow of arrows) {
    bundles.set(pathKey(arrow), (bundles.get(pathKey(arrow)) ?? 0) + 1);
  }
  const drawn = new Map<string, number>();
  return arrows.map((arrow) => {
    const key = pathKey(arrow);
    const position = drawn.get(key) ?? 0;
    drawn.set(key, position + 1);
    const remaining = (bundles.get(key) ?? 1) - 1 - position;
    return ARROW_WIDTH + remaining * ARROW_WIDTH_STEP;
  });
};

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

  const pullBack = (node: PlacedPoint, gap: number): { x: number; y: number } => {
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

/**
 * One arrowhead marker per generator drawn. Markers cannot be styled by the
 * path that uses them, so each generator needs its own in the color of its
 * edges.
 */
export const arrowheadDefs = (
  arrows: readonly ActionArrow[],
  colorOf: (generator: number) => string,
): SVGDefsElement => {
  const defs = svg("defs");
  for (const generator of new Set(arrows.map((arrow) => arrow.generator))) {
    const marker = svg("marker", {
      id: arrowheadId(generator),
      viewBox: "0 0 10 10",
      refX: 9,
      refY: 5,
      markerWidth: 5,
      markerHeight: 5,
      orient: "auto-start-reverse",
    });
    marker.append(svg("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: colorOf(generator) }));
    defs.append(marker);
  }
  return defs;
};

/** The edge layer: every arrow as a curve, tagged with the action it stands for. */
export const renderArrows = (
  arrows: readonly ActionArrow[],
  colorOf: (generator: number) => string,
): SVGGElement => {
  const edges = svg("g", { class: "edges", fill: "none" });
  const widths = strokeWidths(arrows);
  // Widest first, so an arrow sharing a path is drawn over the ones behind it
  // rather than under them.
  const order = arrows.map((_, index) => index).sort((a, b) => widths[b] - widths[a]);
  for (const index of order) {
    const arrow = arrows[index];
    edges.append(
      svg("path", {
        d: arrowPath(arrow),
        stroke: colorOf(arrow.generator),
        "stroke-width": widths[index],
        "marker-end": `url(#${arrowheadId(arrow.generator)})`,
        "data-generator": arrow.generator,
        "data-from": arrow.from.point,
        "data-to": arrow.to.point,
      }),
    );
  }
  return edges;
};
