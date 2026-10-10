import type { DiagramPoint } from "./ringDrag";

/**
 * A node dragged by a pointer that took hold of it off its centre: reports
 * where the node goes as the pointer moves, keeping the pointer on the same
 * spot of the node it grabbed, so the node does not jump to centre under it.
 */
export class NodeDrag {
  readonly #offset: DiagramPoint;

  constructor(node: DiagramPoint, start: DiagramPoint) {
    this.#offset = { x: node.x - start.x, y: node.y - start.y };
  }

  /** The pointer has moved here: where the node now sits. */
  moveTo(at: DiagramPoint): DiagramPoint {
    return { x: at.x + this.#offset.x, y: at.y + this.#offset.y };
  }
}
