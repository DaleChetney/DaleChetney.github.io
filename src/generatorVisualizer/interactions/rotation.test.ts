import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MAX_STEP, Rotation } from "./rotation";

/** Animation frames held back until the test runs them, at the time it gives. */
let pending = new Map<number, FrameRequestCallback>();
let nextId = 1;
const runFrame = (now: number): void => {
  const frames = pending;
  pending = new Map();
  for (const callback of frames.values()) callback(now);
};

beforeEach(() => {
  pending = new Map();
  nextId = 1;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    pending.set(nextId, callback);
    return nextId++;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    pending.delete(id);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Rotation", () => {
  it("starts paused and asks for no frames", () => {
    const rotation = new Rotation(vi.fn());
    expect(rotation.playing).toBe(false);
    expect(pending.size).toBe(0);
  });

  it("reports the seconds between frames while playing", () => {
    const onTick = vi.fn();
    const rotation = new Rotation(onTick);
    rotation.play();
    expect(rotation.playing).toBe(true);
    runFrame(1000);
    expect(onTick).not.toHaveBeenCalled();
    runFrame(1016);
    runFrame(1066);
    expect(onTick.mock.calls.map(([seconds]) => seconds as number)).toEqual([0.016, 0.05]);
  });

  it("stops asking for frames once paused", () => {
    const onTick = vi.fn();
    const rotation = new Rotation(onTick);
    rotation.play();
    runFrame(0);
    rotation.pause();
    expect(rotation.playing).toBe(false);
    expect(pending.size).toBe(0);
  });

  it("does not count the time spent paused", () => {
    const onTick = vi.fn();
    const rotation = new Rotation(onTick);
    rotation.play();
    runFrame(0);
    rotation.pause();
    rotation.play();
    runFrame(5000);
    runFrame(5020);
    expect(onTick.mock.calls).toEqual([[0.02]]);
  });

  it("caps a long gap between frames", () => {
    const onTick = vi.fn();
    const rotation = new Rotation(onTick);
    rotation.play();
    runFrame(0);
    runFrame(60_000);
    expect(onTick).toHaveBeenCalledWith(MAX_STEP);
  });

  it("asks for one frame at a time however often it is played", () => {
    const rotation = new Rotation(vi.fn());
    rotation.play();
    rotation.play();
    expect(pending.size).toBe(1);
  });
});
