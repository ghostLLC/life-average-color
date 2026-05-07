// src/color/gradient.ts — Gradient interpolation in LAB space
import type { LabColor } from '../types';
import { beautifyColors } from './beautify';
import { labToRgb } from './lab';

/** Clamp and format a channel value (0-255) to 2-digit hex */
function toHex(v: number): string {
  return Math.max(0, Math.min(255, Math.round(v)))
    .toString(16)
    .padStart(2, '0');
}

/** Convert an RGB object to a "#RRGGBB" hex string */
function rgbToHex(r: number, g: number, b: number): string {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Build a smooth gradient of hex color strings from a set of core LAB colors.
 *
 * @param coreColors — core LAB colors (sorted by lightness)
 * @param stops — number of color stops in the output gradient
 * @param ratios — proportion of each core color (optional, defaults to equal)
 * @returns array of "#RRGGBB" strings forming the interpolated gradient
 *
 * Algorithm:
 *  1. Beautify the core colors
 *  2. Position each core color by cumulative ratio (proportional to dominance)
 *  3. For each stop, find the two core colors it sits between
 *  4. Linear interpolation in LAB space
 *  5. Convert to RGB and format as "#RRGGBB"
 */
export function buildGradient(
  coreColors: LabColor[],
  stops: number = 12,
  ratios?: number[],
): string[] {
  if (coreColors.length === 0) return [];

  // Step 1: Beautify
  const beautified = beautifyColors(coreColors);

  if (beautified.length === 1) {
    const rgb = labToRgb(beautified[0].l, beautified[0].a, beautified[0].b);
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    return Array(stops).fill(hex);
  }

  // Step 2: Position each core color by its cumulative ratio
  // Dominant colors get more gradient real estate.
  const n = beautified.length;
  const r = ratios && ratios.length === n ? ratios : new Array(n).fill(1 / n);
  // Place each color at the midpoint of its ratio block: cum_sum_before + ratio/2
  const positions: number[] = [];
  let cumulative = 0;
  for (let i = 0; i < n; i++) {
    positions.push(cumulative + r[i] / 2);
    cumulative += r[i];
  }
  // Normalize to 0–1 (in case of floating point drift)
  const maxPos = positions[n - 1];
  for (let i = 0; i < n; i++) {
    positions[i] /= maxPos;
  }

  // Helper: linearly interpolate between two LAB colors
  function interpolateLab(a: LabColor, b: LabColor, t: number): LabColor {
    return {
      l: a.l + (b.l - a.l) * t,
      a: a.a + (b.a - a.a) * t,
      b: a.b + (b.b - a.b) * t,
    };
  }

  // Steps 3-5: Build gradient stops (interpolation + RGB conversion)
  const result: string[] = [];

  for (let i = 0; i < stops; i++) {
    // Position of this stop along 0–1
    const t = stops === 1 ? 0.5 : i / (stops - 1);

    // Find which two core colors this stop sits between
    let leftIdx = 0;
    for (let j = 1; j < n; j++) {
      if (positions[j] > t) break;
      leftIdx = j;
    }
    let rightIdx = Math.min(leftIdx + 1, n - 1);

    // If t is exactly on a core color position, use that color directly
    let lab: LabColor;
    if (leftIdx === rightIdx || positions[leftIdx] === positions[rightIdx]) {
      lab = beautified[leftIdx];
    } else {
      // Linear interpolation factor between the two core colors
      const segmentT = (t - positions[leftIdx]) / (positions[rightIdx] - positions[leftIdx]);
      lab = interpolateLab(beautified[leftIdx], beautified[rightIdx], segmentT);
    }

    // Convert to hex
    const rgb = labToRgb(lab.l, lab.a, lab.b);
    result.push(rgbToHex(rgb.r, rgb.g, rgb.b));
  }

  return result;
}
