/**
 * The top-row keys, in the order they run generators: 1 to 9 for the first
 * nine, 0 for the tenth, then - and = for two more. Matched by where the key
 * is rather than what it types, so the numpad and other layouts' symbols are
 * left alone.
 */
const KEYS = [
  "Digit1",
  "Digit2",
  "Digit3",
  "Digit4",
  "Digit5",
  "Digit6",
  "Digit7",
  "Digit8",
  "Digit9",
  "Digit0",
  "Minus",
  "Equal",
];

/** Where typing a digit means typing it, not running a generator. */
const TYPED_INTO = "input, select, textarea, [contenteditable]";

/**
 * Which drawn generator a key press runs, as its place in the palette, or
 * null for a press that runs none: any other key, one with a modifier
 * held, a key held down and repeating, or one aimed at a field that takes
 * typing. Experimental, and so not mentioned anywhere on the page.
 */
export const generatorForKey = (
  event: Pick<
    KeyboardEvent,
    "code" | "repeat" | "shiftKey" | "ctrlKey" | "altKey" | "metaKey" | "target"
  >,
): number | null => {
  if (event.repeat || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
    return null;
  }
  if (event.target instanceof Element && event.target.closest(TYPED_INTO) !== null) return null;
  const index = KEYS.indexOf(event.code);
  return index === -1 ? null : index;
};
