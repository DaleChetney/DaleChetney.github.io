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
      <input type="radio" name="arrow-bow-width" value="constant" />
      <input type="radio" name="arrow-bow-width" value="relative" />
      <input type="range" id="arrow-curvature" />
      <output for="arrow-curvature"></output>
      <input type="range" id="rotation-period" />
      <output for="rotation-period"></output>
    </div>`;
  const pane = document.querySelector<HTMLElement>("#settings");
  if (pane === null) throw new Error("fixture missing");
  return pane;
};
const radio = (value: string, name = "theme"): HTMLInputElement => {
  const found = document.querySelector<HTMLInputElement>(`input[name="${name}"][value="${value}"]`);
  if (found === null) throw new Error(`no ${name} radio ${value}`);
  return found;
};
const slider = (id = "arrow-curvature"): HTMLInputElement => {
  const found = document.querySelector<HTMLInputElement>(`#${id}`);
  if (found === null) throw new Error(`no slider ${id}`);
  return found;
};
const readout = (id = "arrow-curvature"): string | null | undefined =>
  document.querySelector(`output[for="${id}"]`)?.textContent;
const initial: Settings = {
  theme: "dark",
  arrowCurvature: -0.5,
  arrowBowWidth: "constant",
  rotationPeriod: 6,
};

describe("settingsPanel", () => {
  it("reflects the settings it is given", () => {
    settingsPanel(fixture(), initial, () => {});
    expect(radio("dark").checked).toBe(true);
    expect(radio("light").checked).toBe(false);
    expect(radio("constant", "arrow-bow-width").checked).toBe(true);
    expect(radio("relative", "arrow-bow-width").checked).toBe(false);
    expect(slider().value).toBe("-0.5");
    expect(readout()).toBe("-0.5");
    expect(slider("rotation-period").value).toBe("6");
    expect(readout("rotation-period")).toBe("6");
  });

  it("sizes the slider to the curvature range", () => {
    settingsPanel(fixture(), initial, () => {});
    expect(Number(slider().min)).toBeLessThan(0);
    expect(Number(slider().max)).toBeGreaterThan(0);
    expect(Number(slider().step)).toBeGreaterThan(0);
  });

  it("offers only positive rotation periods", () => {
    settingsPanel(fixture(), initial, () => {});
    expect(Number(slider("rotation-period").min)).toBeGreaterThan(0);
  });

  it("reports a theme change", () => {
    const onChange = vi.fn();
    settingsPanel(fixture(), initial, onChange);
    radio("light").click();
    expect(onChange).toHaveBeenCalledWith({ ...initial, theme: "light" });
  });

  it("reports a bow width change, keeping the other changes", () => {
    const onChange = vi.fn();
    settingsPanel(fixture(), initial, onChange);
    radio("light").click();
    radio("relative", "arrow-bow-width").click();
    expect(onChange).toHaveBeenLastCalledWith({
      ...initial,
      theme: "light",
      arrowBowWidth: "relative",
    });
  });

  it("reports the slider as it moves, and shows the value", () => {
    const onChange = vi.fn();
    settingsPanel(fixture(), initial, onChange);
    slider().value = "1.5";
    slider().dispatchEvent(new Event("input"));
    expect(onChange).toHaveBeenCalledWith({ ...initial, arrowCurvature: 1.5 });
    expect(readout()).toBe("1.5");
  });

  it("reports the rotation period as it moves, keeping the other changes", () => {
    const onChange = vi.fn();
    settingsPanel(fixture(), initial, onChange);
    slider().value = "2";
    slider().dispatchEvent(new Event("input"));
    slider("rotation-period").value = "10";
    slider("rotation-period").dispatchEvent(new Event("input"));
    expect(onChange).toHaveBeenLastCalledWith({
      ...initial,
      arrowCurvature: 2,
      rotationPeriod: 10,
    });
    expect(readout("rotation-period")).toBe("10");
  });
});
