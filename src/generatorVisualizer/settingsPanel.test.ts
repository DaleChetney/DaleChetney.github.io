// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { type Settings } from "./settings";
import { settingsPanel } from "./settingsPanel";

const fixture = (): HTMLElement => {
  document.body.innerHTML = `
    <div id="settings">
      <label><input type="radio" name="theme" value="light" /> Light</label>
      <label><input type="radio" name="theme" value="dark" /> Dark</label>
      <label><input type="radio" name="theme" value="system" /> System</label>
      <input type="range" id="arrow-curvature" />
      <output for="arrow-curvature"></output>
    </div>`;
  const pane = document.querySelector<HTMLElement>("#settings");
  if (pane === null) throw new Error("fixture missing");
  return pane;
};
const radio = (value: string): HTMLInputElement => {
  const found = document.querySelector<HTMLInputElement>(`input[name="theme"][value="${value}"]`);
  if (found === null) throw new Error(`no radio ${value}`);
  return found;
};
const slider = (): HTMLInputElement => {
  const found = document.querySelector<HTMLInputElement>("#arrow-curvature");
  if (found === null) throw new Error("no slider");
  return found;
};
const initial: Settings = { theme: "dark", arrowCurvature: -0.5 };

describe("settingsPanel", () => {
  it("reflects the settings it is given", () => {
    settingsPanel(fixture(), initial, () => {});
    expect(radio("dark").checked).toBe(true);
    expect(radio("light").checked).toBe(false);
    expect(slider().value).toBe("-0.5");
    expect(document.querySelector("output")?.textContent).toBe("-0.5");
  });

  it("sizes the slider to the curvature range", () => {
    settingsPanel(fixture(), initial, () => {});
    expect(Number(slider().min)).toBeLessThan(0);
    expect(Number(slider().max)).toBeGreaterThan(0);
    expect(Number(slider().step)).toBeGreaterThan(0);
  });

  it("reports a theme change", () => {
    const onChange = vi.fn();
    settingsPanel(fixture(), initial, onChange);
    radio("light").click();
    expect(onChange).toHaveBeenCalledWith({ theme: "light", arrowCurvature: -0.5 });
  });

  it("reports the slider as it moves, and shows the value", () => {
    const onChange = vi.fn();
    settingsPanel(fixture(), initial, onChange);
    slider().value = "1.5";
    slider().dispatchEvent(new Event("input"));
    expect(onChange).toHaveBeenCalledWith({ theme: "dark", arrowCurvature: 1.5 });
    expect(document.querySelector("output")?.textContent).toBe("1.5");
  });
});
