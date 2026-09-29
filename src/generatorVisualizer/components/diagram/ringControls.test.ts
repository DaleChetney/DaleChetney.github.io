// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderRingControls, type RingSplit } from "./ringControls";

const split = (orbit: number, size: number, rings: number, counts: number[]): RingSplit => ({
  orbit,
  size,
  rings,
  counts,
});

const mounted = (splits: RingSplit[], orbitCount: number, onStep = vi.fn()): HTMLElement => {
  const host = document.createElement("div");
  host.append(renderRingControls(splits, orbitCount, { onStep }));
  return host;
};

const stepButton = (host: HTMLElement, orbit: number, step: 1 | -1): HTMLButtonElement => {
  const found = host.querySelector<HTMLButtonElement>(
    `.ring-step[data-orbit="${String(orbit)}"][data-step="${String(step)}"]`,
  );
  if (found === null) throw new Error(`no step ${String(step)} on orbit ${String(orbit)}`);
  return found;
};

describe("renderRingControls", () => {
  it("renders nothing when no orbit can be split", () => {
    expect(mounted([], 2).childNodes).toHaveLength(0);
  });

  it("gives each splittable orbit its own stepper", () => {
    const host = mounted([split(0, 12, 1, [1, 2, 3, 4]), split(2, 8, 2, [1, 2])], 3);
    expect(host.querySelectorAll(".ring-control")).toHaveLength(2);
    expect(Array.from(host.querySelectorAll(".ring-name"), (n) => n.textContent)).toEqual([
      "Orbit 1 · 12 points",
      "Orbit 3 · 8 points",
    ]);
    expect(Array.from(host.querySelectorAll(".ring-count"), (n) => n.textContent)).toEqual([
      "1 ring",
      "2 rings",
    ]);
  });

  it("names a lone orbit by its size alone", () => {
    const host = mounted([split(0, 12, 3, [1, 2, 3, 4])], 1);
    expect(host.querySelector(".ring-name")?.textContent).toBe("12 points");
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
    const host = mounted([split(1, 12, 2, [1, 2, 3, 4])], 2, onStep);
    stepButton(host, 1, 1).click();
    stepButton(host, 1, -1).click();
    expect(onStep.mock.calls).toEqual([
      [1, 1],
      [1, -1],
    ]);
  });
});
