// src/color/lab.ts — RGB ↔ LAB conversion using color-convert
import convert from 'color-convert';
import type { LabColor, RGBColor } from '../types';

// Re-export types for convenience
export type { LabColor, RGBColor } from '../types';

/** Convert RGB (0-255 each) to LAB (L: 0-100, a/b: ±128) */
export function rgbToLab(r: number, g: number, b: number): LabColor {
  const [l, a, lb] = convert.rgb.lab([r, g, b]);
  return { l, a, b: lb };
}

/** Convert LAB (L: 0-100, a/b: ±128) to RGB (0-255 each) */
export function labToRgb(l: number, a: number, b: number): RGBColor {
  const [r, g, lb] = convert.lab.rgb([l, a, b]);
  return { r, g, b: lb };
}
