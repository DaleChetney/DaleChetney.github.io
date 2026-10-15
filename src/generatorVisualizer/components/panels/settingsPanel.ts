import { qs } from "@shared/dom";
import {
  ARROW_WIDTHS,
  CURVATURE,
  PERMUTATION_SPEED,
  ROTATION_SPEED,
  type Settings,
} from "../../settings";

/** The settings chosen from a few named options, each with a radio group of its own. */
type ChoiceSetting = "theme" | "arrowBowWidth" | "arrowHead";

/** The numeric settings, each with a slider of its own. */
type SliderSetting = "arrowCurvature" | "arrowWidth" | "rotationSpeed" | "permutationSpeed";

/**
 * Wire the settings pane's controls: a radio group each for the theme, the
 * arrows' bow width and where their heads go, and a slider each for the arrow
 * curvature, the arrow width, the rotation speed and the permutation speed, all in the static markup.
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

  /** A slider and the readout beside it, sized to `range`, bound to `key`, its value followed by `unit`. */
  const slider = (
    id: string,
    key: SliderSetting,
    range: { min: number; max: number; step: number },
    unit = "",
  ): void => {
    const input = qs<HTMLInputElement>(`#${id}`, pane);
    const readout = qs<HTMLOutputElement>(`output[for="${id}"]`, pane);
    input.min = String(range.min);
    input.max = String(range.max);
    input.step = String(range.step);
    input.value = String(initial[key]);
    readout.textContent = `${input.value}${unit}`;
    input.addEventListener("input", () => {
      readout.textContent = `${input.value}${unit}`;
      current = { ...current, [key]: Number(input.value) };
      onChange(current);
    });
  };

  choice("theme", "theme");
  choice("arrow-bow-width", "arrowBowWidth");
  choice("arrow-head", "arrowHead");
  slider("arrow-curvature", "arrowCurvature", CURVATURE);
  slider("arrow-width", "arrowWidth", ARROW_WIDTHS);
  slider("rotation-speed", "rotationSpeed", ROTATION_SPEED, "/sec");
  slider("permutation-speed", "permutationSpeed", PERMUTATION_SPEED, "/sec");
};
