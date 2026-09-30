import { qs } from "@shared/dom";
import { CURVATURE, ROTATION_PERIOD, type Settings, type Theme } from "./settings";

/** The numeric settings, each with a slider of its own. */
type SliderSetting = "arrowCurvature" | "rotationPeriod";

/**
 * Wire the settings pane's controls: a radio per theme, and a slider each for
 * the arrow curvature and the rotation period, all in the static markup.
 *
 * The pane holds no state. It is shown `initial` once, and from then on every
 * change is reported whole through `onChange`; whoever owns the settings
 * decides what follows.
 */
export const settingsPanel = (
  pane: HTMLElement,
  initial: Settings,
  onChange: (settings: Settings) => void,
): void => {
  let current = initial;

  const themes = Array.from(pane.querySelectorAll<HTMLInputElement>('input[name="theme"]'));
  for (const radio of themes) {
    radio.checked = radio.value === initial.theme;
    radio.addEventListener("change", () => {
      current = { ...current, theme: radio.value as Theme };
      onChange(current);
    });
  }

  /** A slider and the readout beside it, sized to `range` and bound to `key`. */
  const slider = (
    id: string,
    key: SliderSetting,
    range: { min: number; max: number; step: number },
  ): void => {
    const input = qs<HTMLInputElement>(`#${id}`, pane);
    const readout = qs<HTMLOutputElement>(`output[for="${id}"]`, pane);
    input.min = String(range.min);
    input.max = String(range.max);
    input.step = String(range.step);
    input.value = String(initial[key]);
    readout.textContent = input.value;
    input.addEventListener("input", () => {
      readout.textContent = input.value;
      current = { ...current, [key]: Number(input.value) };
      onChange(current);
    });
  };

  slider("arrow-curvature", "arrowCurvature", CURVATURE);
  slider("rotation-period", "rotationPeriod", ROTATION_PERIOD);
};
