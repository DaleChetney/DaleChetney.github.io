// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderRingControls, type RingControlsView, type RingSplit } from "./ringControls";

const split = (
  orbit: number,
  size: number,
  rings: number,
  counts: number[],
  playing = false,
  locked = true,
): RingSplit => ({ orbit, size, rings, counts, playing, locked });

const mounted = (
  splits: RingSplit[],
  orbitCount: number,
  view: Partial<RingControlsView> = {},
): HTMLElement => {
  const host = document.createElement("div");
  host.append(
    renderRingControls(splits, orbitCount, {
      onStep: vi.fn(),
      onTogglePlay: vi.fn(),
      onToggleLock: vi.fn(),
      ...view,
    }),
  );
  return host;
};

const stepButton = (host: HTMLElement, orbit: number, step: 1 | -1): HTMLButtonElement => {
  const found = host.querySelector<HTMLButtonElement>(
    `.ring-step[data-orbit="${String(orbit)}"][data-step="${String(step)}"]`,
  );
  if (found === null) throw new Error(`no step ${String(step)} on orbit ${String(orbit)}`);
  return found;
};

const playButton = (host: HTMLElement, orbit: number): HTMLButtonElement => {
  const found = host.querySelector<HTMLButtonElement>(`.ring-play[data-orbit="${String(orbit)}"]`);
  if (found === null) throw new Error(`no play button on orbit ${String(orbit)}`);
  return found;
};

const lockButton = (host: HTMLElement, orbit: number): HTMLButtonElement => {
  const found = host.querySelector<HTMLButtonElement>(`.ring-lock[data-orbit="${String(orbit)}"]`);
  if (found === null) throw new Error(`no lock button on orbit ${String(orbit)}`);
  return found;
};

describe("renderRingControls", () => {
  it("renders nothing when there are no orbits", () => {
    expect(mounted([], 0).childNodes).toHaveLength(0);
  });

  it("gives each orbit its own stepper", () => {
    const host = mounted([split(0, 12, 1, [1, 2, 3, 4]), split(2, 8, 2, [1, 2])], 3);
    expect(host.querySelectorAll(".ring-control")).toHaveLength(2);
    expect(Array.from(host.querySelectorAll(".ring-name"), (n) => n.textContent)).toEqual([
      "Orbit of 12",
      "Orbit of 8",
    ]);
    expect(Array.from(host.querySelectorAll(".ring-count"), (n) => n.textContent)).toEqual([
      "1",
      "2",
    ]);
  });

  it("leaves a lone orbit unnamed, showing only its ring count", () => {
    const host = mounted([split(0, 12, 3, [1, 2, 3, 4])], 1);
    expect(host.querySelector(".ring-name")).toBeNull();
    expect(host.querySelector(".ring-count")?.textContent).toBe("3");
  });

  it("boxes the lock, the play button, the count and the steps, in that order", () => {
    const host = mounted([split(0, 12, 3, [1, 2, 3, 4])], 1);
    const stepper = host.querySelector(".ring-stepper");
    expect(Array.from(stepper?.children ?? [], (child) => child.className)).toEqual([
      "ring-lock",
      "ring-play",
      "ring-count",
      "ring-steps",
    ]);
    expect(stepper?.querySelectorAll(".ring-step")).toHaveLength(2);
  });

  it("disables the step past either end", () => {
    const host = mounted([split(0, 8, 1, [1, 2]), split(1, 9, 3, [1, 3])], 2);
    expect(stepButton(host, 0, -1).disabled).toBe(true);
    expect(stepButton(host, 0, 1).disabled).toBe(false);
    expect(stepButton(host, 1, 1).disabled).toBe(true);
    expect(stepButton(host, 1, -1).disabled).toBe(false);
  });

  it("reports the orbit and the direction stepped", () => {
    const onStep = vi.fn();
    const host = mounted([split(1, 12, 2, [1, 2, 3, 4])], 2, { onStep });
    stepButton(host, 1, 1).click();
    stepButton(host, 1, -1).click();
    expect(onStep.mock.calls).toEqual([
      [1, 1],
      [1, -1],
    ]);
  });

  it("offers both steps disabled on an orbit that cannot be split", () => {
    const host = mounted([split(0, 4, 1, [1])], 2);
    expect(stepButton(host, 0, 1).disabled).toBe(true);
    expect(stepButton(host, 0, -1).disabled).toBe(true);
  });

  it("offers play on a locked orbit, a single ring included, and not on an unlocked one", () => {
    const host = mounted(
      [split(0, 8, 1, [1, 2]), split(1, 9, 3, [1, 3]), split(2, 4, 1, [1], false, false)],
      3,
    );
    expect(playButton(host, 0).disabled).toBe(false);
    expect(playButton(host, 1).disabled).toBe(false);
    expect(playButton(host, 2).disabled).toBe(true);
  });

  it("offers unlock while locked, and lock while unlocked, naming the orbit", () => {
    const host = mounted([split(0, 8, 1, [1, 2]), split(1, 4, 1, [1], false, false)], 2);
    expect(lockButton(host, 0).getAttribute("aria-label")).toBe("Unlock nodes: Orbit of 8");
    expect(lockButton(host, 0).getAttribute("aria-pressed")).toBe("false");
    expect(lockButton(host, 1).getAttribute("aria-label")).toBe("Lock nodes: Orbit of 4");
    expect(lockButton(host, 1).getAttribute("aria-pressed")).toBe("true");
  });

  it("draws the padlock open while unlocked", () => {
    const host = mounted([split(0, 8, 1, [1, 2]), split(1, 4, 1, [1], false, false)], 2);
    const shackle = (orbit: number) =>
      lockButton(host, orbit).querySelector("path")?.getAttribute("d");
    expect(shackle(0)).not.toBe(shackle(1));
  });

  it("reports the orbit whose lock was pressed", () => {
    const onToggleLock = vi.fn();
    const host = mounted([split(0, 8, 2, [1, 2]), split(1, 9, 3, [1, 3])], 2, { onToggleLock });
    lockButton(host, 0).click();
    expect(onToggleLock.mock.calls).toEqual([[0]]);
  });

  it("offers play while still, and pause while turning, naming the orbit", () => {
    const host = mounted([split(0, 8, 2, [1, 2], false), split(1, 9, 3, [1, 3], true)], 2);
    expect(playButton(host, 0).getAttribute("aria-label")).toBe("Play rotation: Orbit of 8");
    expect(playButton(host, 0).getAttribute("aria-pressed")).toBe("false");
    expect(playButton(host, 1).getAttribute("aria-label")).toBe("Pause rotation: Orbit of 9");
    expect(playButton(host, 1).getAttribute("aria-pressed")).toBe("true");
  });

  it("reports the orbit whose play button was pressed", () => {
    const onTogglePlay = vi.fn();
    const host = mounted([split(0, 8, 2, [1, 2]), split(1, 9, 3, [1, 3])], 2, { onTogglePlay });
    playButton(host, 1).click();
    expect(onTogglePlay.mock.calls).toEqual([[1]]);
  });
});
