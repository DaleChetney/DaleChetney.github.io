import { qs } from "@shared/dom";
import { ARROW_WIDTHS, CURVATURE, ROTATION_PERIOD, type Settings } from "../../settings";

/** The settings chosen from a few named options, each with a radio group of its own. */
type ChoiceSetting = "theme" | "arrowBowWidth" | "arrowHead";

/** The numeric settings, each with a slider of its own. */
type SliderSetting = "arrowCurvature" | "arrowWidth" | "rotationPeriod";

/**
 * Wire the settings pane's controls: a radio group each for the theme, the
 * arrows' bow width and where their heads go, and a slider each for the arrow
 * curvature, the arrow width and the rotation period, all in the static markup.
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

  /** The radios named `name`, one per option, bound to `key`. */
  const choice = (name: string, key: ChoiceSetting): void => {
    const radios = pane.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`);
    for (const radio of radios) {
      radio.checked = radio.value === initial[key];
      radio.addEventListener("change", () => {
        current = { ...current, [key]: radio.value };
        onChange(current);
      });
    }
  };

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

  choice("theme", "theme");
  choice("arrow-bow-width", "arrowBowWidth");
  choice("arrow-head", "arrowHead");
  slider("arrow-curvature", "arrowCurvature", CURVATURE);
  slider("arrow-width", "arrowWidth", ARROW_WIDTHS);
  slider("rotation-period", "rotationPeriod", ROTATION_PERIOD);
};
