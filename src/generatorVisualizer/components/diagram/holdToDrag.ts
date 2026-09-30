/** How long a press must be held before it becomes a drag, in milliseconds. */
export const HOLD_DELAY = 200;

export interface HoldToDragHandlers {
  /** The press was held long enough: a drag begins where the pointer is now. */
  onStart: (clientX: number, clientY: number) => void;
  /** The pointer moved during the drag. */
  onMove: (clientX: number, clientY: number) => void;
  /** The drag ended, the pointer released or the gesture lost. */
  onEnd: () => void;
}

export interface HoldToDrag {
  /**
   * Whether the click in hand is the tail of a drag rather than a click of its
   * own, to be ignored. Asking uses up the answer: a drag swallows one click.
   */
  swallowClick: () => boolean;
}

/**
 * Turn a press held on `target` into a drag. A press released before
 * {@link HOLD_DELAY} is left alone to be the click it is; one held that long
 * starts a drag, which follows the pointer until it is released, and the click
 * the release would otherwise make is marked to be swallowed.
 *
 * The pointer is captured once the drag starts, so it can wander off the
 * target and keep dragging. Until then the release is listened for on the
 * whole document, since a press can end anywhere.
 */
export const holdToDrag = (target: Element, handlers: HoldToDragHandlers): HoldToDrag => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let dragging = false;
  let swallow = false;
  let at = { x: 0, y: 0 };

  const release = (): void => {
    clearTimeout(timer);
    timer = undefined;
    document.removeEventListener("pointerup", release);
    document.removeEventListener("pointercancel", release);
    if (!dragging) return;
    dragging = false;
    swallow = true;
    handlers.onEnd();
  };

  target.addEventListener("pointerdown", (event) => {
    const { button, clientX, clientY, pointerId } = event as PointerEvent;
    if (button !== 0) return;
    // A drag released off its target makes no click, so a mark left from one is stale.
    swallow = false;
    at = { x: clientX, y: clientY };
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      dragging = true;
      if (pointerId !== undefined && "setPointerCapture" in target) {
        target.setPointerCapture(pointerId);
      }
      handlers.onStart(at.x, at.y);
    }, HOLD_DELAY);
    document.addEventListener("pointerup", release);
    document.addEventListener("pointercancel", release);
  });

  target.addEventListener("pointermove", (event) => {
    const { clientX, clientY } = event as PointerEvent;
    at = { x: clientX, y: clientY };
    if (dragging) handlers.onMove(clientX, clientY);
  });

  return {
    swallowClick: () => {
      const swallowed = swallow;
      swallow = false;
      return swallowed;
    },
  };
};
