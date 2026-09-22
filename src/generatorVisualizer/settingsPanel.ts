import { qs } from "@shared/dom";
import { CURVATURE, type Settings, type Theme } from "./settings";

/**
 * Wire the settings pane's controls: a radio per theme and a slider for the
 * arrow curvature, all in the static markup.
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
  const slider = qs<HTMLInputElement>('input[type="range"]', pane);
  const readout = qs<HTMLOutputElement>("output", pane);

  for (const radio of themes) {
    radio.checked = radio.value === initial.theme;
    radio.addEventListener("change", () => {
      current = { ...current, theme: radio.value as Theme };
      onChange(current);
    });
  }

  slider.min = String(CURVATURE.min);
  slider.max = String(CURVATURE.max);
  slider.step = String(CURVATURE.step);
  slider.value = String(initial.arrowCurvature);
  readout.textContent = slider.value;
  slider.addEventListener("input", () => {
    readout.textContent = slider.value;
    current = { ...current, arrowCurvature: Number(slider.value) };
    onChange(current);
  });
};
