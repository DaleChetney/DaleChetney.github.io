// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { type Settings } from "../../settings";
import { settingsPanel } from "./settingsPanel";

const fixture = (): HTMLElement => {
  document.body.innerHTML = `
    <div id="settings">
      <label><input type="radio" name="theme" value="light" /> Light</label>
      <label><input type="radio" name="theme" value="dark" /> Dark</label>
      <label><input type="radio" name="theme" value="system" /> System</label>
      <input type="radio" name="arrow-bow-width" value="constant" />
      <input type="radio" name="arrow-bow-width" value="relative" />
      <input type="radio" name="arrow-head" value="end" />
      <input type="radio" name="arrow-head" value="middle" />
      <input type="range" id="arrow-curvature" />
      <output for="arrow-curvature"></output>
      <input type="range" id="arrow-width" />
      <output for="arrow-width"></output>
      <input type="range" id="rotation-speed" />
      <output for="rotation-speed"></output>
      <input type="range" id="permutation-speed" />
      <output for="permutation-speed"></output>
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
  arrowWidth: 2.5,
  arrowBowWidth: "constant",
  arrowHead: "end",
  rotationSpeed: 0.15,
  permutationSpeed: 1,
};

describe("settingsPanel", () => {
  it("reflects the settings it is given", () => {
    settingsPanel(fixture(), initial, () => {});
    expect(radio("dark").checked).toBe(true);
    expect(radio("light").checked).toBe(false);
    expect(radio("constant", "arrow-bow-width").checked).toBe(true);
    expect(radio("relative", "arrow-bow-width").checked).toBe(false);
    expect(radio("end", "arrow-head").checked).toBe(true);
    expect(radio("middle", "arrow-head").checked).toBe(false);
    expect(slider().value).toBe("-0.5");
    expect(readout()).toBe("-0.5");
    expect(slider("rotation-speed").value).toBe("0.15");
    expect(readout("rotation-speed")).toBe("0.15/sec");
    expect(slider("permutation-speed").value).toBe("1");
    expect(readout("permutation-speed")).toBe("1/sec");
  });

  it("sizes the slider to the curvature range", () => {
    settingsPanel(fixture(), initial, () => {});
    expect(Number(slider().min)).toBeLessThan(0);
    expect(Number(slider().max)).toBeGreaterThan(0);
    expect(Number(slider().step)).toBeGreaterThan(0);
  });

  it("sizes the arrow width slider from 2 to 5", () => {
    settingsPanel(fixture(), initial, () => {});
    expect(slider("arrow-width").min).toBe("2");
    expect(slider("arrow-width").max).toBe("5");
    expect(slider("arrow-width").value).toBe("2.5");
  });

  it("reports the arrow width as it moves", () => {
    const onChange = vi.fn();
    settingsPanel(fixture(), initial, onChange);
    slider("arrow-width").value = "3.1";
    slider("arrow-width").dispatchEvent(new Event("input"));
    expect(onChange).toHaveBeenCalledWith({ ...initial, arrowWidth: 3.1 });
    expect(readout("arrow-width")).toBe("3.1");
  });

  it("offers only positive speeds", () => {
    settingsPanel(fixture(), initial, () => {});
    expect(Number(slider("rotation-speed").min)).toBeGreaterThan(0);
    expect(Number(slider("permutation-speed").min)).toBeGreaterThan(0);
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

  it("reports a change of where the arrowheads go", () => {
    const onChange = vi.fn();
    settingsPanel(fixture(), initial, onChange);
    radio("middle", "arrow-head").click();
    expect(onChange).toHaveBeenCalledWith({ ...initial, arrowHead: "middle" });
  });

  it("reports the slider as it moves, and shows the value", () => {
    const onChange = vi.fn();
    settingsPanel(fixture(), initial, onChange);
    slider().value = "1.5";
    slider().dispatchEvent(new Event("input"));
    expect(onChange).toHaveBeenCalledWith({ ...initial, arrowCurvature: 1.5 });
    expect(readout()).toBe("1.5");
  });

  it("reports the speeds as they move, keeping the other changes, per second", () => {
    const onChange = vi.fn();
    settingsPanel(fixture(), initial, onChange);
    slider().value = "2";
    slider().dispatchEvent(new Event("input"));
    slider("rotation-speed").value = "0.5";
    slider("rotation-speed").dispatchEvent(new Event("input"));
    slider("permutation-speed").value = "2.5";
    slider("permutation-speed").dispatchEvent(new Event("input"));
    expect(onChange).toHaveBeenLastCalledWith({
      ...initial,
      arrowCurvature: 2,
      rotationSpeed: 0.5,
      permutationSpeed: 2.5,
    });
    expect(readout("rotation-speed")).toBe("0.5/sec");
    expect(readout("permutation-speed")).toBe("2.5/sec");
    expect(readout()).toBe("2");
  });
});
