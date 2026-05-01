// src/types.ts — Shared type definitions for Life Average Color

/** LAB color representation */
export interface LabColor {
  l: number; // 0-100 (lightness)
  a: number; // -128 to 127 (green→red)
  b: number; // -128 to 127 (blue→yellow)
}

/** RGB color representation */
export interface RGBColor {
  r: number; // 0-255
  g: number;
  b: number;
}

/** A color cluster from K-means, with its proportion in the image */
export interface ColorCluster {
  color: LabColor;
  ratio: number; // 0-1
}

/** Full analysis result for a time period */
export interface AnalysisResult {
  coreColors: LabColor[];
  gradientColors: string[]; // CSS rgb() strings
  timeLabel: string; // e.g. "2026年3月"
  caption: string; // AI-generated
  photoCount: number;
}

/** Time period for photo selection */
export interface TimePeriod {
  startDate: Date;
  endDate: Date;
  label: string; // e.g. "2026年3月"
}
