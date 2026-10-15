import type { Permutation } from "@shared/mathUtils/groups/permutations";

/**
 * The permutations asked to run and not yet started, oldest first. A click on
 * a generator's play button or on one of its arrows adds to it; the nodes are
 * moved by one permutation at a time, taken from the front.
 */
export class PermutationBuffer {
  readonly #queue: Permutation[] = [];

  get size(): number {
    return this.#queue.length;
  }

  push(permutation: Permutation): void {
    this.#queue.push(permutation);
  }

  /** The oldest permutation waiting, taken out; nothing when none is. */
  shift(): Permutation | undefined {
    return this.#queue.shift();
  }

  clear(): void {
    this.#queue.length = 0;
  }
}
