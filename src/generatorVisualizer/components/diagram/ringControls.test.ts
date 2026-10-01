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
  centered = false,
): RingSplit => ({ orbit, size, rings, counts, playing, locked, centered, centerable: size >= 4 });

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
      onToggleCenter: vi.fn(),
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

const centerButton = (host: HTMLElement, orbit: number): HTMLButtonElement => {
  const found = host.querySelector<HTMLButtonElement>(
    `.ring-center[data-orbit="${String(orbit)}"]`,
  );
  if (found === null) throw new Error(`no center button on orbit ${String(orbit)}`);
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

  it("boxes the lock, the play and center buttons, the count and the steps, in that order", () => {
    const host = mounted([split(0, 12, 3, [1, 2, 3, 4])], 1);
    const stepper = host.querySelector(".ring-stepper");
    expect(Array.from(stepper?.children ?? [], (child) => child.className)).toEqual([
      "ring-lock",
      "ring-play",
      "ring-center",
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

  it("offers a center node while there is none, and takes it away while there is", () => {
    const host = mounted([split(0, 8, 1, [1, 2]), split(1, 7, 2, [1, 2], false, true, true)], 2);
    expect(centerButton(host, 0).getAttribute("aria-label")).toBe("Add center node: Orbit of 8");
    expect(centerButton(host, 0).getAttribute("aria-pressed")).toBe("false");
    expect(centerButton(host, 1).getAttribute("aria-label")).toBe("Remove center node: Orbit of 7");
    expect(centerButton(host, 1).getAttribute("aria-pressed")).toBe("true");
  });

  it("draws a bullseye while centered, and an empty circle while not", () => {
    const host = mounted([split(0, 8, 1, [1, 2]), split(1, 7, 2, [1, 2], false, true, true)], 2);
    expect(centerButton(host, 0).querySelectorAll("circle")).toHaveLength(1);
    expect(centerButton(host, 1).querySelectorAll("circle")).toHaveLength(2);
  });

  it("disables the center on an orbit too small to ring the rest", () => {
    const host = mounted([split(0, 3, 1, [1]), split(1, 4, 1, [1])], 2);
    expect(centerButton(host, 0).disabled).toBe(true);
    expect(centerButton(host, 1).disabled).toBe(false);
  });

  it("reports the orbit whose center button was pressed", () => {
    const onToggleCenter = vi.fn();
    const host = mounted([split(0, 8, 2, [1, 2]), split(1, 9, 3, [1, 3])], 2, { onToggleCenter });
    centerButton(host, 1).click();
    expect(onToggleCenter.mock.calls).toEqual([[1]]);
  });

  it("gives every button a tooltip matching its name", () => {
    const host = mounted([split(0, 12, 2, [1, 2, 3, 4])], 1);
    const buttons = Array.from(host.querySelectorAll("button"));
    expect(buttons).toHaveLength(5);
    for (const button of buttons) {
      expect(button.title).not.toBe("");
      expect(button.title).toBe(button.getAttribute("aria-label"));
    }
  });

  it("explains the count in its tooltip, center node included", () => {
    const host = mounted(
      [split(0, 12, 3, [1, 2, 3, 4]), split(1, 7, 2, [1, 2], false, true, true)],
      2,
    );
    const counts = Array.from(host.querySelectorAll<HTMLElement>(".ring-count"), (n) => n.title);
    expect(counts).toEqual(["3 rings of 4", "2 rings of 3, around a center node"]);
    const lone = mounted([split(0, 5, 1, [1])], 1).querySelector<HTMLElement>(".ring-count");
    expect(lone?.title).toBe("1 ring of 5");
  });
});
