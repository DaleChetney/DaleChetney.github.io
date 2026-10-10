/** A position in the diagram's own coordinates, the ones its nodes are placed in. */
export interface DiagramPoint {
  x: number;
  y: number;
}

/**
 * Where a pointer at these client coordinates sits in the diagram's own
 * coordinates, undoing whatever scaling and offset put the SVG on screen.
 * Null while the SVG is not on screen to be measured.
 */
export const toDiagram = (
  svg: Pick<SVGGraphicsElement, "getScreenCTM">,
  clientX: number,
  clientY: number,
): DiagramPoint | null => {
  const m = svg.getScreenCTM();
  if (m === null) return null;
  const det = m.a * m.d - m.b * m.c;
  if (det === 0) return null;
  const [x, y] = [clientX - m.e, clientY - m.f];
  return { x: (m.d * x - m.c * y) / det, y: (m.a * y - m.b * x) / det };
};

/**
 * How close to the centre a pointer's angle is ignored. Right at the centre a
 * hair's movement swings the angle round, which would spin the ring.
 */
const CENTRE_DEAD_ZONE = 4;

/**
 * The angle of `at` about `center`, in whole turns, increasing clockwise as
 * the diagram draws it (its y axis points down). Undefined at the centre
 * itself, where there is no angle to take.
 */
export const angleAbout = (center: DiagramPoint, at: DiagramPoint): number | undefined => {
  const [dx, dy] = [at.x - center.x, at.y - center.y];
  if (Math.hypot(dx, dy) < CENTRE_DEAD_ZONE) return undefined;
  return Math.atan2(dy, dx) / (2 * Math.PI);
};

/**
 * The shorter way round from one angle to another, in turns: clockwise
 * positive, never more than half a turn either way. Between two pointer
 * events the pointer cannot have gone further, so this is how far it went.
 */
export const turnBetween = (from: number, to: number): number => {
  const delta = (((to - from) % 1) + 1) % 1;
  return delta >= 0.5 ? delta - 1 : delta;
};

/**
 * A pointer dragged round a centre: reports how far it has turned since the
 * move before, so a ring that is turned by each report keeps the same angle
 * under the pointer that it had when the drag began.
 */
export class RingDrag {
  readonly #center: DiagramPoint;
  #last: number | undefined;
  #total = 0;

  constructor(center: DiagramPoint, start: DiagramPoint) {
    this.#center = center;
    this.#last = angleAbout(center, start);
  }

  /** How far the pointer has turned in all, clockwise, since the drag began. */
  get total(): number {
    return this.#total;
  }

  /**
   * The pointer has moved here: how far it turned since the last move,
   * clockwise positive. A move through the centre reports nothing, and the
   * drag picks up again from wherever the pointer comes out.
   */
  moveTo(at: DiagramPoint): number {
    const angle = angleAbout(this.#center, at);
    if (angle === undefined) return 0;
    const turned = this.#last === undefined ? 0 : turnBetween(this.#last, angle);
    this.#last = angle;
    this.#total += turned;
    return turned;
  }
}
