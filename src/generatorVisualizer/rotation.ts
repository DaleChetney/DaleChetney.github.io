/**
 * The longest step one frame may advance by, in seconds. A backgrounded tab
 * gets no frames, and without a cap the first one back would jump the rings
 * by however long the reader was away.
 */
export const MAX_STEP = 0.1;

/**
 * A clock that runs only while playing, reporting each animation frame as the
 * seconds since the one before. It knows nothing of what turns: whoever
 * listens decides how far a second takes the rings.
 */
export class Rotation {
  readonly #onTick: (seconds: number) => void;
  #frame: number | null = null;
  #last: number | null = null;

  constructor(onTick: (seconds: number) => void) {
    this.#onTick = onTick;
  }

  get playing(): boolean {
    return this.#frame !== null;
  }

  play(): void {
    if (this.playing) return;
    this.#last = null;
    this.#frame = requestAnimationFrame(this.#tick);
  }

  pause(): void {
    if (this.#frame !== null) cancelAnimationFrame(this.#frame);
    this.#frame = null;
  }

  readonly #tick = (now: number): void => {
    // The first frame only marks the time: there is no step before it to report.
    if (this.#last !== null) this.#onTick(Math.min(MAX_STEP, (now - this.#last) / 1000));
    this.#last = now;
    this.#frame = requestAnimationFrame(this.#tick);
  };
}
