// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { applyTheme, CURVATURE, DEFAULT_SETTINGS, loadSettings, saveSettings } from "./settings";

const KEY = "generatorVisualizer.settings";

describe("settings", () => {
  beforeEach(() => localStorage.clear());

  it("starts from the defaults when nothing is stored", () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toEqual({ theme: "system", arrowCurvature: 1 });
  });

  it("round-trips what was saved", () => {
    saveSettings({ theme: "dark", arrowCurvature: -0.5 });
    expect(loadSettings()).toEqual({ theme: "dark", arrowCurvature: -0.5 });
  });

  it("falls back per field on a stored value it does not recognise", () => {
    localStorage.setItem(KEY, JSON.stringify({ theme: "sepia", arrowCurvature: "wide" }));
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps a stored curvature within the slider's range", () => {
    localStorage.setItem(KEY, JSON.stringify({ arrowCurvature: 99 }));
    expect(loadSettings().arrowCurvature).toBe(CURVATURE.max);
    localStorage.setItem(KEY, JSON.stringify({ arrowCurvature: -99 }));
    expect(loadSettings().arrowCurvature).toBe(CURVATURE.min);
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
