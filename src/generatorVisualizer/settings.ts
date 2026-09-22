import { load, save } from "@shared/storage";

const STORAGE_KEY = "generatorVisualizer.settings";

export type Theme = "light" | "dark" | "system";

const THEMES: readonly Theme[] = ["light", "dark", "system"];

/** What the reader has chosen about how the page looks, independent of any group. */
export interface Settings {
  theme: Theme;
  /**
   * How far the arrows bow, as a multiple of the usual amount. 0 is a straight
   * chord; negative bows them the other way round.
   */
  arrowCurvature: number;
}

/** The range the curvature slider offers. */
export const CURVATURE = { min: -2, max: 2, step: 0.1 } as const;

export const DEFAULT_SETTINGS: Settings = { theme: "system", arrowCurvature: 1 };

const isTheme = (value: unknown): value is Theme => THEMES.includes(value as Theme);

/**
 * The stored settings, field by field: a value that is missing or that this
 * version of the page does not recognise falls back to its default, and a
 * curvature is kept inside the slider's range.
 */
export const loadSettings = (): Settings => {
  const stored: unknown = load(STORAGE_KEY, {});
  const fields = typeof stored === "object" && stored !== null ? (stored as Partial<Settings>) : {};
  const curvature = typeof fields.arrowCurvature === "number" ? fields.arrowCurvature : null;
  return {
    theme: isTheme(fields.theme) ? fields.theme : DEFAULT_SETTINGS.theme,
    arrowCurvature:
      curvature === null
        ? DEFAULT_SETTINGS.arrowCurvature
        : Math.min(CURVATURE.max, Math.max(CURVATURE.min, curvature)),
  };
};

export const saveSettings = (settings: Settings): void => {
  save(STORAGE_KEY, settings);
};

/**
 * Put the theme into effect. The stylesheet takes every color from the
 * `color-scheme`, so choosing one is the whole of switching theme; "system"
 * hands the choice back to the browser by offering both.
 */
export const applyTheme = (theme: Theme): void => {
  document.documentElement.style.colorScheme = theme === "system" ? "light dark" : theme;
};
