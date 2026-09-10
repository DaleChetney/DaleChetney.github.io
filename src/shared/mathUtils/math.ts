export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const mod = (n: number, m: number): number => ((n % m) + m) % m;

/** Axial hex coordinate. */
export interface Hex {
  q: number;
  r: number;
}

/** Distance between two axial hex coordinates, in steps. */
export const hexDistance = (a: Hex, b: Hex): number =>
  (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;

/** Pixel center of a flat-top hex of the given size (center to corner). */
export const hexToPixel = (hex: Hex, size: number): { x: number; y: number } => ({
  x: size * (3 / 2) * hex.q,
  y: size * Math.sqrt(3) * (hex.r + hex.q / 2),
});
