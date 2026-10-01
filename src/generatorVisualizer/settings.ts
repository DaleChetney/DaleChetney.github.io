import { load, save } from "@shared/storage";
import type { BowWidth } from "./components/diagram/arrow";

const STORAGE_KEY = "generatorVisualizer.settings";

export type Theme = "light" | "dark" | "system";

const THEMES: readonly Theme[] = ["light", "dark", "system"];

const BOW_WIDTHS: readonly BowWidth[] = ["constant", "relative"];

/** What the reader has chosen about how the page looks, independent of any group. */
export interface Settings {
  theme: Theme;
  /**
   * How far the arrows bow, as a multiple of the usual amount. 0 is a straight
   * chord; negative bows them the other way round.
   */
  arrowCurvature: number;
  /**
   * How the bow grows with an arrow's length: "constant" caps it, "relative"
   * keeps it in proportion to the chord.
   */
  arrowBowWidth: BowWidth;
  /** Seconds the innermost ring takes to turn once while the rings are playing. */
  rotationPeriod: number;
}

/** The range the curvature slider offers. */
export const CURVATURE = { min: -3, max: 3, step: 0.1 } as const;

/** The range the rotation period slider offers, in seconds per turn. */
export const ROTATION_PERIOD = { min: 1, max: 20, step: 0.5 } as const;

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  arrowCurvature: 1,
  arrowBowWidth: "constant",
  rotationPeriod: 6,
};

const isTheme = (value: unknown): value is Theme => THEMES.includes(value as Theme);

const isBowWidth = (value: unknown): value is BowWidth => BOW_WIDTHS.includes(value as BowWidth);

/** A stored number kept inside its slider's range, or the default if it is not a number. */
const inRange = (value: unknown, range: { min: number; max: number }, fallback: number): number =>
  typeof value === "number" ? Math.min(range.max, Math.max(range.min, value)) : fallback;

/**
 * The stored settings, field by field: a value that is missing or that this
 * version of the page does not recognise falls back to its default, and a
 * number is kept inside its slider's range.
 */
export const loadSettings = (): Settings => {
  const stored: unknown = load(STORAGE_KEY, {});
  const fields = typeof stored === "object" && stored !== null ? (stored as Partial<Settings>) : {};
  return {
    theme: isTheme(fields.theme) ? fields.theme : DEFAULT_SETTINGS.theme,
    arrowCurvature: inRange(fields.arrowCurvature, CURVATURE, DEFAULT_SETTINGS.arrowCurvature),
    arrowBowWidth: isBowWidth(fields.arrowBowWidth)
      ? fields.arrowBowWidth
      : DEFAULT_SETTINGS.arrowBowWidth,
    rotationPeriod: inRange(
      fields.rotationPeriod,
      ROTATION_PERIOD,
      DEFAULT_SETTINGS.rotationPeriod,
    ),
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
