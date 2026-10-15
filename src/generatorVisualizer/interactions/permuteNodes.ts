import { permutationKey, type Permutation } from "@shared/mathUtils/groups/permutations";
import { actionArrows, pointAlongArrow, stackPositions } from "../components/diagram/arrow";
import type { PlacedPoint } from "../components/diagram/node";
import type { Diagram } from "../components/diagram/permutationDiagram";
import type { Settings } from "../settings";
import type { PermutationBuffer } from "./permutationBuffer";

/** What running a permutation needs of a scene: where its points are, what is drawn, and a way to commit. */
export interface Permutable {
  readonly diagram: Diagram;
  readonly palette: readonly Permutation[];
  permute(permutation: Permutation): void;
}

/**
 * Runs the queued permutations on the diagram's nodes, one at a time: each
 * node travels its arrow to the slot of its image, and when they arrive the
 * scene is permuted to match.
 *
 * Nothing is frozen at the start. Every frame a node is placed between where
 * the scene puts it and where it puts its image, as they are now, so rings
 * that turn or are dragged meanwhile carry the journey along with them; and
 * when it ends, the node is already where its new slot is.
 *
 * The scene is passed to each call rather than kept, since a new group brings
 * a new one.
 */
export class PermuteNodes {
  readonly #buffer: PermutationBuffer;
  #running: Permutation | null = null;
  /** How far the running permutation has come, from 0 to 1. */
  #progress = 0;

  constructor(buffer: PermutationBuffer) {
    this.#buffer = buffer;
  }

  /** Whether a permutation is running or waiting to. */
  get busy(): boolean {
    return this.#running !== null || this.#buffer.size > 0;
  }

  /**
   * Run on by this many seconds at `speed` permutations a second, taking up
   * the next queued permutation if none is running. One that reaches its end
   * is committed; any time left over is not carried into the next.
   */
  advance(scene: Permutable, seconds: number, speed: number): void {
    if (this.#running === null) {
      this.#running = this.#buffer.shift() ?? null;
      this.#progress = 0;
    }
    if (this.#running === null) return;
    this.#progress += seconds * speed;
    if (this.#progress >= 1) this.#commit(scene);
  }

  /** Where to draw each point now: on its way to its image, or where the scene puts it. */
  points(
    scene: Permutable,
    shape: Pick<Settings, "arrowCurvature" | "arrowBowWidth">,
  ): PlacedPoint[] {
    const running = this.#running;
    const { points } = scene.diagram;
    if (running === null) return points;
    const byPoint = new Map(points.map((placed) => [placed.point, placed]));
    const stacks = this.#stacks(scene, running);
    return points.map((placed) => {
      const target = byPoint.get(running[placed.point - 1]);
      if (target === undefined || target.point === placed.point) return placed;
      const { x, y } = pointAlongArrow(
        placed,
        target,
        this.#progress,
        shape.arrowCurvature,
        shape.arrowBowWidth,
        stacks.get(placed.point) ?? 0,
      );
      return { point: placed.point, x, y };
    });
  }

  /**
   * Commit the running permutation now, and drop the rest: the arrangement is
   * about to change under them, and they were queued against the old one.
   */
  finish(scene: Permutable): void {
    if (this.#running !== null) this.#commit(scene);
    this.#buffer.clear();
  }

  /** Forget everything, committing nothing, as a new scene does. */
  drop(): void {
    this.#running = null;
    this.#progress = 0;
    this.#buffer.clear();
  }

  #commit(scene: Permutable): void {
    const running = this.#running;
    this.#running = null;
    this.#progress = 0;
    if (running !== null) scene.permute(running);
  }

  /**
   * Each moved point's place in its arrow's stack, so it rides that arrow
   * rather than the one beneath; empty when the permutation is not drawn.
   */
  #stacks(scene: Permutable, running: Permutation): Map<number, number> {
    const key = permutationKey(running);
    const generator = scene.palette.findIndex((drawn) => permutationKey(drawn) === key);
    if (generator === -1) return new Map();
    const arrows = actionArrows(scene.diagram.points, scene.palette);
    const stacks = stackPositions(arrows);
    return new Map(
      arrows.flatMap((arrow, index) =>
        arrow.generator === generator ? [[arrow.from.point, stacks[index]] as const] : [],
      ),
    );
  }
}
