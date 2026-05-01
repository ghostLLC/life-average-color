// src/color/synthesize.ts — Cross-photo color palette synthesis using weighted K-means
import kmeans from 'kmeans-ts';
import type { LabColor, ColorCluster } from '../types';

/**
 * Multiplier to convert cluster ratios into discrete sample counts.
 * Ratio 1.0 → SAMPLE_WEIGHT samples. Keeps array sizes manageable
 * while providing enough resolution for weighted K-means.
 */
const SAMPLE_WEIGHT = 100;

/**
 * Synthesize a cross-photo color palette by running weighted K-means
 * across the dominant color clusters of all photos.
 *
 * Each cluster is weighted by its ratio so that dominant colors in a photo
 * contribute more samples than minor accent colors. The result is a palette
 * of the most representative colors across the entire photo set.
 *
 * @param allPhotoClusters  Array of per-photo cluster arrays (each inner array
 *                          comes from extractDominantColors).
 * @param targetColors      Desired number of colors in the output palette (default 5).
 * @returns                 Array of LabColor representing the synthesized palette,
 *                          sorted by lightness descending. Returns [] on empty input.
 */
export function synthesizeColorPalette(
  allPhotoClusters: ColorCluster[][],
  targetColors: number = 5,
): LabColor[] {
  // --- 1. Collect weighted samples from all clusters ---
  const samples: number[][] = [];

  for (const photoClusters of allPhotoClusters) {
    for (const cluster of photoClusters) {
      const count = Math.round(cluster.ratio * SAMPLE_WEIGHT);
      if (count <= 0) continue;

      const point = [cluster.color.l, cluster.color.a, cluster.color.b];
      for (let i = 0; i < count; i++) {
        // Push a fresh array so kmeans doesn't mutate shared references
        samples.push([point[0], point[1], point[2]]);
      }
    }
  }

  // --- 2. Edge case: no samples at all ---
  if (samples.length === 0) {
    return [];
  }

  // --- 3. Adjust target K downward if we have too few samples ---
  const effectiveK = Math.min(targetColors, samples.length);

  // Single color — compute the simple mean of all weighted samples
  if (effectiveK <= 1) {
    const avg = averageLab(samples);
    return [avg];
  }

  // --- 4. Run K-means on the consolidated sample set ---
  const result = kmeans(samples, effectiveK);

  // --- 5. Build output palette from centroids ---
  const palette: LabColor[] = result.centroids.map((centroid) => ({
    l: centroid[0],
    a: centroid[1],
    b: centroid[2],
  }));

  // --- 6. Sort by lightness descending for a natural reading order ---
  palette.sort((a, b) => b.l - a.l);

  return palette;
}

/** Compute the simple mean of LAB vectors */
function averageLab(samples: number[][]): LabColor {
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
