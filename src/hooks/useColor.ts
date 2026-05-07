// src/hooks/useColor.ts — Full analysis pipeline: photos → AnalysisResult
import { useState, useCallback, useRef } from 'react';

import { decodeImageToPixels } from '../color/decodeImage';
import { extractDominantColors } from '../color/extract';
import { synthesizeColorPalette, type SynthesizedColor } from '../color/synthesize';
import { buildGradient } from '../color/gradient';
import { labToRgb } from '../color/lab';
import { nameColor, type NamedColor } from '../color/nameColor';
import { generateCaption } from '../caption/generate';
import type { AnalysisResult, ColorCluster, RecommendedPhoto, PhotoAsset, LabColor } from '../types';

// -- Types -------------------------------------------------------------------

export interface UseColorResult {
  /** Run the full analysis pipeline against the given photos */
  analyze: (
    photos: PhotoAsset[],
    timeLabel: string,
    userFeeling?: string,
  ) => Promise<AnalysisResult>;
  /** Whether analysis is currently in progress */
  loading: boolean;
  /** Error message if the last analysis failed, null otherwise */
  error: string | null;
  /** Clear the current error state */
  clearError: () => void;
  /** Abort the currently running analysis */
  abort: () => void;
  /** Current processing progress (0..total), updated during analysis */
  progress: { current: number; total: number } | null;
}

// -- Concurrency pool --------------------------------------------------------

const CONCURRENCY = 4; // parallel photo decode limit

/** Result from processing a single photo */
interface PhotoProcessResult {
  uri: string;
  clusters: ColorCluster[];
}

/**
 * Process items with bounded concurrency.
 * Returns results in the same order as the input array.
 * Stops early if abortRef.current becomes true.
 */
async function processWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
  onProgress?: (current: number, total: number) => void,
  abortRef?: React.MutableRefObject<boolean>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  let completed = 0;

  const worker = async (): Promise<void> => {
    while (cursor < items.length) {
      if (abortRef?.current) return;

      const idx = cursor++;
      try {
        results[idx] = await fn(items[idx], idx);
      } finally {
        completed++;
        onProgress?.(completed, items.length);
      }
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);

  return results.filter((_, i) => results[i] !== undefined);
}

// -- Helpers -----------------------------------------------------------------

/** Convert a LabColor to a hex string like "FF6B35" (uppercase, no #) */
function labToHex(l: number, a: number, b: number): string {
  const rgb = labToRgb(l, a, b);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, '0');
  return `${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`.toUpperCase();
}

/**
 * Pick a merge threshold adapted to the palette's chroma.
 */
function adaptiveMergeThreshold(
  items: SynthesizedColor[],
): number {
  if (items.length <= 1) return 25;
  let nearNeutral = 0;
  for (const { color: c } of items) {
    const chroma = Math.sqrt(c.a * c.a + c.b * c.b);
    if (chroma < 12) nearNeutral++;
  }
  if (nearNeutral >= 2) return 30;
  return 18;
}

/**
 * Merge similar colors, summing their ratios.
 */
function mergeCloseColors(
  items: SynthesizedColor[],
  threshold: number,
): SynthesizedColor[] {
  if (items.length <= 1) return items.map((s) => ({ ...s }));
  const remaining = items.map((s) => ({ color: { ...s.color }, ratio: s.ratio }));

  while (remaining.length > 1) {
    let minDist = Infinity;
    let mi = 0;
    let mj = 0;
    for (let i = 0; i < remaining.length; i++) {
      for (let j = i + 1; j < remaining.length; j++) {
        const d = labDist(remaining[i].color, remaining[j].color);
        if (d < minDist) { minDist = d; mi = i; mj = j; }
      }
    }
    if (minDist >= threshold) break;
    const totalRatio = remaining[mi].ratio + remaining[mj].ratio;
    remaining[mi] = {
      color: {
        l: (remaining[mi].color.l + remaining[mj].color.l) / 2,
        a: (remaining[mi].color.a + remaining[mj].color.a) / 2,
        b: (remaining[mi].color.b + remaining[mj].color.b) / 2,
      },
      ratio: totalRatio,
    };
    remaining.splice(mj, 1);
  }
  return remaining;
}

/**
 * Select recommended photos adaptively.
 * Only includes photos whose palette distance is reasonably close to the best.
 */
function selectRecommendedPhotos(
  scored: { uri: string; distance: number }[],
): RecommendedPhoto[] {
  if (scored.length === 0) return [];
  const best = scored[0].distance;
  // If the best match is still a poor fit, don't recommend any
  if (best > 50) return [];
  // Allow photos within 2× the best distance, capped at 3
  const threshold = Math.max(best * 2, 20);
  return scored
    .filter((s) => s.distance <= threshold)
    .slice(0, 3)
    .map((s) => ({ uri: s.uri, distance: s.distance }));
}

/** LAB distance between a cluster and a palette color */
function labDist(
  c1: { l: number; a: number; b: number },
  c2: { l: number; a: number; b: number },
): number {
  const dl = c1.l - c2.l;
  const da = c1.a - c2.a;
  const db = c1.b - c2.b;
  return Math.sqrt(dl * dl + da * da + db * db);
}

/**
 * Compute a "match score" for a photo against the core palette.
 * Lower = better match. Uses the minimum distance from any photo cluster
 * to any palette color, weighted by cluster ratio.
 */
function photoPaletteDistance(
  clusters: ColorCluster[],
  palette: { l: number; a: number; b: number }[],
): number {
  if (clusters.length === 0 || palette.length === 0) return Infinity;

  let totalDist = 0;
  let totalWeight = 0;

  for (const cluster of clusters) {
    // Find closest palette color to this cluster
    let minDist = Infinity;
    for (const p of palette) {
      const d = labDist(cluster.color, p);
      if (d < minDist) minDist = d;
    }
    totalDist += minDist * cluster.ratio;
    totalWeight += cluster.ratio;
  }

  return totalWeight > 0 ? totalDist / totalWeight : Infinity;
}

// -- useColor hook -----------------------------------------------------------

export function useColor(): UseColorResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const abortRef = useRef(false);

  const clearError = useCallback(() => setError(null), []);

  const abort = useCallback(() => {
    abortRef.current = true;
  }, []);

  const analyze = useCallback(
    async (
      photos: PhotoAsset[],
      timeLabel: string,
      userFeeling?: string,
    ): Promise<AnalysisResult> => {
      setLoading(true);
      setError(null);
      setProgress(null);
      abortRef.current = false;

      let processedCount = 0;

      try {
        // -- Step 1: Decode each photo and extract dominant colors (parallel) --
        const photoResults = await processWithConcurrency(
          photos,
          CONCURRENCY,
          async (photo): Promise<PhotoProcessResult> => {
            const { pixels, width, height } = await decodeImageToPixels(photo.uri);
            const clusters = extractDominantColors(pixels, width, height, 3);
            return { uri: photo.uri, clusters };
          },
          (current, total) => setProgress({ current, total }),
          abortRef,
        );

        // Filter out empty results
        const allPhotoClusters: ColorCluster[][] = [];
        const successfulPhotos: PhotoProcessResult[] = [];
        for (const r of photoResults) {
          if (r.clusters.length > 0) {
            allPhotoClusters.push(r.clusters);
            successfulPhotos.push(r);
            processedCount++;
          }
        }

        if (abortRef.current) {
          throw new Error('__ABORTED__');
        }

        if (allPhotoClusters.length === 0) {
          throw new Error('没有可分析的照片');
        }

        // -- Step 2: Synthesize cross-photo palette ---------------------------
        const rawColors = synthesizeColorPalette(allPhotoClusters, 3);
        if (rawColors.length === 0) {
          throw new Error('无法生成调色板');
        }

        // -- Step 2b: Deduplicate — merge colors that are too close -----------
        const mergeThreshold = adaptiveMergeThreshold(rawColors);
        const mergedColors = mergeCloseColors(rawColors, mergeThreshold);
        // Normalize ratios after merge
        const totalRatio = mergedColors.reduce((s, c) => s + c.ratio, 0);
        const finalColors = mergedColors.map((c) => ({
          ...c,
          ratio: totalRatio > 0 ? c.ratio / totalRatio : 1 / mergedColors.length,
        }));
        const coreColors: LabColor[] = finalColors.map((c) => c.color);
        const coreRatios: number[] = finalColors.map((c) => c.ratio);

        // -- Step 3: Build gradient stops -------------------------------------
        const gradientColors = buildGradient(coreColors, 8, coreRatios);

        // -- Step 4: Name the core colors (with ratios) -----------------------
        const coreHexes = coreColors.map((c) => labToHex(c.l, c.a, c.b));
        const namedColors: NamedColor[] = coreHexes.map((h, i) => ({
          ...nameColor(h),
          ratio: coreRatios[i],
        }));

        // -- Step 5: Find best-matching photos (0–3, adaptive) ----------------
        const scored: { uri: string; distance: number }[] = [];
        for (const r of successfulPhotos) {
          const distance = photoPaletteDistance(r.clusters, coreColors);
          scored.push({ uri: r.uri, distance });
        }
        scored.sort((a, b) => a.distance - b.distance);
        const recommendedPhotos = selectRecommendedPhotos(scored);

        // -- Step 6: Generate caption (with optional user feeling) ------------
        const colorDescriptors = coreHexes.map((h) => `#${h}`);
        const caption = await generateCaption(colorDescriptors, timeLabel, userFeeling);

        const result: AnalysisResult = {
          coreColors,
          gradientColors,
          timeLabel,
          caption: caption || `${timeLabel} 的生活底色`,
          photoCount: processedCount,
          namedColors,
          recommendedPhotos,
        };

        return result;
      } catch (err) {
        if (err instanceof Error && err.message === '__ABORTED__') {
          throw err;
        }
        const message = err instanceof Error ? err.message : '分析失败，请重试';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
        setProgress(null);
      }
    },
    [],
  );

  return { analyze, loading, error, clearError, abort, progress };
}
