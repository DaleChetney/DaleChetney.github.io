import chroma from "chroma-js";

/**
 * Lightness every series color is held at. Constant lightness keeps contrast
 * against the page the same for all of them — which matters on a page that
 * follows the system light/dark preference — and stops one series reading as
 * more prominent than another when only hue should distinguish them.
 */
const LIGHTNESS = 55;

/** Saturation ceiling, past which most hues leave sRGB at this lightness. */
const MAX_CHROMA = 80;

/** Where the wheel starts, chosen so a lone color comes out red rather than pink. */
const START_HUE = 10;

/**
 * The most saturated color of this hue at `LIGHTNESS` that still lands inside
 * sRGB. Rendering an out-of-gamut color clips the RGB channels independently,
 * which drags hue and lightness along with it and pulls neighbours back
 * together; searching for the chroma that fits keeps the exact hue spacing the
 * wheel promises, at the cost of some colors being less saturated than others.
 */
const fitToGamut = (hue: number): string => {
  let inside = 0;
  let outside = MAX_CHROMA;
  for (let step = 0; step < 20; step++) {
    const middle = (inside + outside) / 2;
    if (chroma.hcl(hue, middle, LIGHTNESS).clipped()) outside = middle;
    else inside = middle;
  }
  return chroma.hcl(hue, inside, LIGHTNESS).hex();
};

/**
 * `count` colors spread evenly around the hue wheel, as hex strings.
 *
 * Sized to the series being drawn rather than taken from a fixed list, so the
 * colors stay as far apart as the count allows however many there are, and
 * never repeat.
 */
export const equidistantColors = (count: number): string[] =>
  Array.from({ length: count }, (_, index) =>
    fitToGamut((START_HUE + (360 * index) / count) % 360),
  );
