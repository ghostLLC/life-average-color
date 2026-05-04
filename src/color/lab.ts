// src/color/lab.ts — RGB ↔ LAB conversion using color-convert
import convert from 'color-convert';
import type { LabColor, RGBColor } from '../types';

// Re-export types for convenience
export type { LabColor, RGBColor } from '../types';

/** Convert RGB (0-255 each) to LAB (L: 0-100, a/b: ±128) */
export function rgbToLab(r: number, g: number, b: number): LabColor {
  const [l, aVal, bVal] = convert.rgb.lab([r, g, b]);
  return { l, a: aVal, b: bVal };
}

/** Convert LAB (L: 0-100, a/b: ±128) to RGB (0-255 each) */
export function labToRgb(l: number, a: number, b: number): RGBColor {
  const [r, gVal, bVal] = convert.lab.rgb([l, a, b]);
  return { r, g: gVal, b: bVal };
}

/** Compute the simple mean of an array of LAB vectors ([l, a, b]) */
export function averageLab(samples: number[][]): LabColor {
  const n = samples.length;
  let sl = 0;
  let sa = 0;
  let sb = 0;

  for (const s of samples) {
    sl += s[0];
    sa += s[1];
    sb += s[2];
  }

  return { l: sl / n, a: sa / n, b: sb / n };
}
