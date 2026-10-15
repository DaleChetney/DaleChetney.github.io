// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  applyTheme,
  ARROW_WIDTHS,
  CURVATURE,
  DEFAULT_SETTINGS,
  loadSettings,
  ROTATION_PERIOD,
  saveSettings,
} from "./settings";

const KEY = "generatorVisualizer.settings";

describe("settings", () => {
  beforeEach(() => localStorage.clear());

  it("starts from the defaults when nothing is stored", () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toEqual({
      theme: "system",
      arrowCurvature: 1,
      arrowWidth: 2.3,
      arrowBowWidth: "constant",
      arrowHead: "end",
      rotationPeriod: 6,
    });
  });

  it("round-trips what was saved", () => {
    const saved = {
      theme: "dark",
      arrowCurvature: -0.5,
      arrowWidth: 3.5,
      arrowBowWidth: "relative",
      arrowHead: "middle",
      rotationPeriod: 7.5,
    } as const;
    saveSettings(saved);
    expect(loadSettings()).toEqual(saved);
  });

  it("falls back per field on a stored value it does not recognise", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        theme: "sepia",
        arrowCurvature: "wide",
        arrowWidth: "thick",
        arrowBowWidth: "elastic",
        arrowHead: "start",
        rotationPeriod: "slow",
      }),
    );
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps a stored curvature within the slider's range", () => {
    localStorage.setItem(KEY, JSON.stringify({ arrowCurvature: 99 }));
    expect(loadSettings().arrowCurvature).toBe(CURVATURE.max);
    localStorage.setItem(KEY, JSON.stringify({ arrowCurvature: -99 }));
    expect(loadSettings().arrowCurvature).toBe(CURVATURE.min);
  });

  it("keeps a stored arrow width within the slider's range", () => {
    localStorage.setItem(KEY, JSON.stringify({ arrowWidth: 9 }));
    expect(loadSettings().arrowWidth).toBe(ARROW_WIDTHS.max);
    localStorage.setItem(KEY, JSON.stringify({ arrowWidth: 1 }));
    expect(loadSettings().arrowWidth).toBe(ARROW_WIDTHS.min);
  });

  it("keeps a stored rotation period within the slider's range", () => {
    localStorage.setItem(KEY, JSON.stringify({ rotationPeriod: 999 }));
    expect(loadSettings().rotationPeriod).toBe(ROTATION_PERIOD.max);
    localStorage.setItem(KEY, JSON.stringify({ rotationPeriod: 0 }));
    expect(loadSettings().rotationPeriod).toBe(ROTATION_PERIOD.min);
  });

  it("offers curvature both ways round the chord", () => {
    expect(CURVATURE.min).toBeLessThan(0);
    expect(CURVATURE.max).toBeGreaterThan(0);
  });
});

describe("applyTheme", () => {
  it("forces the chosen scheme on the root element", () => {
    applyTheme("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    applyTheme("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("leaves both schemes on offer for the system to choose", () => {
    applyTheme("system");
    expect(document.documentElement.style.colorScheme).toBe("light dark");
  });
});
