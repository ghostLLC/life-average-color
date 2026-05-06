// src/color/beautify.ts — Color beautification: boost saturation, slight brighten
import type { LabColor } from '../types';

/** Clamp a number between min and max */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Beautify a set of LAB colors by slightly boosting saturation and brightness.
 * Returns a new array — does not mutate the input.
 *
 * - Saturation boost: multiply a and b channels by 1.08
 * - Brightness boost: multiply l by 1.01
 * - Clamping: l → 0-100, a/b → -128-127
 */
export function beautifyColors(colors: LabColor[]): LabColor[] {
  return colors.map((c) => ({
    l: clamp(c.l * 1.01, 0, 100),
    a: clamp(c.a * 1.08, -128, 127),
    b: clamp(c.b * 1.08, -128, 127),
  }));
}
