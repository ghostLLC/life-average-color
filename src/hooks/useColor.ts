// src/hooks/useColor.ts — Full analysis pipeline: photos → AnalysisResult
import { useState, useCallback, useRef } from 'react';
import * as MediaLibrary from 'expo-media-library';

import { decodeImageToPixels } from '../color/decodeImage';
import { extractDominantColors } from '../color/extract';
import { synthesizeColorPalette } from '../color/synthesize';
import { buildGradient } from '../color/gradient';
import { labToRgb } from '../color/lab';
import { nameColors } from '../color/nameColor';
import { generateCaption } from '../caption/generate';
import type { AnalysisResult, ColorCluster, RecommendedPhoto } from '../types';

// -- Types -------------------------------------------------------------------

export interface UseColorResult {
  /** Run the full analysis pipeline against the given photos */
  analyze: (
    photos: MediaLibrary.Asset[],
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
  asset: MediaLibrary.Asset;
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
      photos: MediaLibrary.Asset[],
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
            return { asset: photo, clusters };
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
        const coreColors = synthesizeColorPalette(allPhotoClusters, 5);
        if (coreColors.length === 0) {
          throw new Error('无法生成调色板');
        }

        // -- Step 3: Build gradient stops -------------------------------------
        const gradientColors = buildGradient(coreColors, 8);

        // -- Step 4: Name the core colors (for social sharing) ----------------
        const coreHexes = coreColors.map((c) => labToHex(c.l, c.a, c.b));
        const namedColors = nameColors(coreHexes);

        // -- Step 5: Find best-matching photos (0–3) -------------------------
        const scored: { asset: MediaLibrary.Asset; distance: number }[] = [];
        for (const r of successfulPhotos) {
          const distance = photoPaletteDistance(r.clusters, coreColors);
          scored.push({ asset: r.asset, distance });
        }
        // Sort by distance ascending (closest first), take top 3
        scored.sort((a, b) => a.distance - b.distance);
        const recommendedPhotos: RecommendedPhoto[] = scored
          .slice(0, 3)
          .map((s) => ({ uri: s.asset.uri, distance: s.distance }));

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
