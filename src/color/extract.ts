// src/color/extract.ts — K-means clustering to extract dominant colors from pixel data
import kmeans from 'kmeans-ts';
import { rgbToLab } from './lab';
import type { LabColor, ColorCluster } from '../types';

/** Maximum number of pixel samples to feed into K-means */
const MAX_SAMPLES = 5000;

/**
 * Extract dominant colors from raw image pixel data using K-means clustering.
 *
 * @param pixels  ImageData.data — RGBA flat array (4 bytes per pixel).
 * @param width   Image width in pixels.
 * @param height  Image height in pixels.
 * @param k       Number of color clusters (default 3).
 * @returns       Clusters sorted by proportion descending (highest ratio first).
 */
export function extractDominantColors(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  k: number = 3,
): ColorCluster[] {
  // --- 1. Sample pixels sparsely ---
  const totalPixels = width * height;
  const stride = Math.max(1, Math.floor(totalPixels / MAX_SAMPLES));

  const samples: number[][] = [];

  for (let i = 0; i < totalPixels; i += stride) {
    const offset = i * 4;
    const r = pixels[offset];
    const g = pixels[offset + 1];
    const b = pixels[offset + 2];
    const a = pixels[offset + 3];

    // Skip fully transparent pixels
    if (a === 0) continue;

    const lab = rgbToLab(r, g, b);
    samples.push([lab.l, lab.a, lab.b]);
  }

  // --- 2. Edge case: not enough samples ---
  if (samples.length === 0) {
    return [];
  }

  // If we have fewer samples than k, reduce k
  const effectiveK = Math.min(k, samples.length);

  if (effectiveK <= 1) {
    // Single color — just average everything
    const avg = averageLab(samples);
    return [{ color: avg, ratio: 1 }];
  }

  // --- 3. Run K-means ---
  const result = kmeans(samples, effectiveK);

  // --- 4. Build clusters with ratios ---
  const { centroids, indexes } = result;
  const clusterCounts = new Array<number>(effectiveK).fill(0);

  for (const idx of indexes) {
    clusterCounts[idx]++;
  }

  const total = indexes.length;
  const clusters: ColorCluster[] = centroids.map((centroid, i) => ({
    color: { l: centroid[0], a: centroid[1], b: centroid[2] } as LabColor,
    ratio: clusterCounts[i] / total,
  }));

  // Sort by ratio descending
  clusters.sort((a, b) => b.ratio - a.ratio);

  return clusters;
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
