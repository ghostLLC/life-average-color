// src/color/synthesize.ts — Cross-photo color palette synthesis using weighted K-means
import kmeans from 'kmeans-ts';
import { averageLab } from './lab';
import type { LabColor, ColorCluster } from '../types';

/** A synthesized color with its proportion in the final palette */
export interface SynthesizedColor {
  color: LabColor;
  ratio: number; // 0-1
}

const SAMPLE_WEIGHT = 100;

/**
 * Synthesize a cross-photo color palette by running weighted K-means
 * across the dominant color clusters of all photos.
 *
 * Returns colors with their proportion (ratio) based on cluster sizes.
 * Sorted by lightness descending. Returns [] on empty input.
 */
export function synthesizeColorPalette(
  allPhotoClusters: ColorCluster[][],
  targetColors: number = 5,
): SynthesizedColor[] {
  // 1. Collect weighted samples from all clusters
  const samples: number[][] = [];

  for (const photoClusters of allPhotoClusters) {
    for (const cluster of photoClusters) {
      const count = Math.round(cluster.ratio * SAMPLE_WEIGHT);
      if (count <= 0) continue;

      const point = [cluster.color.l, cluster.color.a, cluster.color.b];
      for (let i = 0; i < count; i++) {
        samples.push(point.slice());
      }
    }
  }

  if (samples.length === 0) return [];

  // 2. Adjust target K downward if needed
  const effectiveK = Math.min(targetColors, samples.length);

  if (effectiveK <= 1) {
    const avg = averageLab(samples);
    return [{ color: avg, ratio: 1 }];
  }

  // 3. Run K-means
  const result = kmeans(samples, effectiveK);

  // 4. Build palette with ratios from cluster sizes
  const counts = new Array<number>(effectiveK).fill(0);
  for (const idx of result.indexes) {
    counts[idx]++;
  }
  const total = result.indexes.length;

  const palette: SynthesizedColor[] = result.centroids.map((centroid, i) => ({
    color: { l: centroid[0], a: centroid[1], b: centroid[2] },
    ratio: counts[i] / total,
  }));

  // 5. Sort by lightness descending
  palette.sort((a, b) => b.color.l - a.color.l);

  return palette;
}
