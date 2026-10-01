import { load, save } from "@shared/storage";

const STORAGE_KEY = "generatorVisualizer.lastView";

/** A class index and the keys of the elements chosen from it, as stored. */
export type StoredSelection = [classIndex: number, keys: string[]][];

/** What the reader was looking at, to open on next time. */
export interface LastView {
  /** The group's LMFDB label. */
  group: string;
  /** The representation's id within the group. */
  representation: string;
  /**
   * The open classes and their chosen elements, written in that
   * representation; null if what was stored is not a selection.
   */
  selection: StoredSelection | null;
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isSelection = (value: unknown): value is StoredSelection =>
  Array.isArray(value) &&
  value.every(
    (entry) =>
      Array.isArray(entry) &&
      entry.length === 2 &&
      Number.isInteger(entry[0]) &&
      isStringArray(entry[1]),
  );

/**
 * The view last saved, or null if none was, or what was stored is not one.
 * Whether its group, representation and elements still exist is for the
 * catalogue and the scene to say.
 */
export const loadLastView = (): LastView | null => {
  const stored: unknown = load(STORAGE_KEY, null);
  if (typeof stored !== "object" || stored === null) return null;
  const { group, representation, selection } = stored as Partial<Record<keyof LastView, unknown>>;
  if (typeof group !== "string" || typeof representation !== "string") return null;
  return { group, representation, selection: isSelection(selection) ? selection : null };
};

export const saveLastView = (view: LastView): void => {
  save(STORAGE_KEY, view);
};
