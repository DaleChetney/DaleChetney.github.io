// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { HOLD_DELAY, holdToDrag, type HoldToDragHandlers } from "./holdToDrag";

const pointer = (target: EventTarget, type: string, x = 0, y = 0, button = 0): void => {
  target.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, button, bubbles: true }));
};

let target: HTMLElement;
let handlers: {
  onStart: Mock<HoldToDragHandlers["onStart"]>;
  onMove: Mock<HoldToDragHandlers["onMove"]>;
  onEnd: Mock<HoldToDragHandlers["onEnd"]>;
};
let gesture: ReturnType<typeof holdToDrag>;

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = "<div id='target'></div>";
  target = document.querySelector("#target") as HTMLElement;
  handlers = {
    onStart: vi.fn<HoldToDragHandlers["onStart"]>(),
    onMove: vi.fn<HoldToDragHandlers["onMove"]>(),
    onEnd: vi.fn<HoldToDragHandlers["onEnd"]>(),
  };
  gesture = holdToDrag(target, handlers);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("holdToDrag", () => {
  it("leaves a quick press to be a click", () => {
    pointer(target, "pointerdown");
    vi.advanceTimersByTime(HOLD_DELAY - 1);
    pointer(target, "pointerup");
    vi.advanceTimersByTime(HOLD_DELAY);
    expect(handlers.onStart).not.toHaveBeenCalled();
    expect(gesture.swallowClick()).toBe(false);
  });

  it("starts a drag once the press has been held, where the pointer is by then", () => {
    pointer(target, "pointerdown", 10, 20);
    pointer(target, "pointermove", 12, 21);
    expect(handlers.onMove).not.toHaveBeenCalled();
    vi.advanceTimersByTime(HOLD_DELAY);
    expect(handlers.onStart).toHaveBeenCalledWith(12, 21);
  });

  it("follows the pointer until it is released, then swallows one click", () => {
    pointer(target, "pointerdown");
    vi.advanceTimersByTime(HOLD_DELAY);
    pointer(target, "pointermove", 30, 40);
    pointer(target, "pointerup");
    pointer(target, "pointermove", 50, 60);
    expect(handlers.onMove.mock.calls).toEqual([[30, 40]]);
    expect(handlers.onEnd).toHaveBeenCalledOnce();
    expect(gesture.swallowClick()).toBe(true);
    expect(gesture.swallowClick()).toBe(false);
  });

  it("ends the drag on a release anywhere", () => {
    pointer(target, "pointerdown");
    vi.advanceTimersByTime(HOLD_DELAY);
    pointer(document.body, "pointerup");
    expect(handlers.onEnd).toHaveBeenCalledOnce();
  });

  it("ends the drag when the gesture is lost", () => {
    pointer(target, "pointerdown");
    vi.advanceTimersByTime(HOLD_DELAY);
    pointer(target, "pointercancel");
    expect(handlers.onEnd).toHaveBeenCalledOnce();
  });

  it("forgets a swallowed click the release never made, at the next press", () => {
    pointer(target, "pointerdown");
    vi.advanceTimersByTime(HOLD_DELAY);
    pointer(document.body, "pointerup");
    pointer(target, "pointerdown");
    pointer(target, "pointerup");
    expect(gesture.swallowClick()).toBe(false);
  });

  it("keeps a touch that moves from scrolling the page, which would cancel the drag", () => {
    const move = new Event("touchmove", { bubbles: true, cancelable: true });
    target.dispatchEvent(move);
    expect(move.defaultPrevented).toBe(true);
  });

  it("ignores a press of any button but the main one", () => {
    pointer(target, "pointerdown", 0, 0, 2);
    vi.advanceTimersByTime(HOLD_DELAY);
    expect(handlers.onStart).not.toHaveBeenCalled();
  });
});
