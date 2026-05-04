// src/hooks/useColor.ts — Full analysis pipeline: photos → AnalysisResult
import { useState, useCallback, useRef } from 'react';
import * as MediaLibrary from 'expo-media-library';

import { decodeImageToPixels } from '../color/decodeImage';
import { extractDominantColors } from '../color/extract';
import { synthesizeColorPalette } from '../color/synthesize';
import { buildGradient } from '../color/gradient';
import { labToRgb } from '../color/lab';
import { generateCaption } from '../caption/generate';
import type { AnalysisResult, ColorCluster } from '../types';

// -- Types -------------------------------------------------------------------

export interface UseColorResult {
  /** Run the full analysis pipeline against the given photos */
  analyze: (photos: MediaLibrary.Asset[], timeLabel: string) => Promise<AnalysisResult>;
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

  // Spawn workers (bounded by concurrency)
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);

  // Filter out holes (aborted entries) and return
  return results.filter((_, i) => results[i] !== undefined);
}

// -- Helpers -----------------------------------------------------------------

/** Convert a LabColor to a hex string like "FF6B35" */
function labToHex(l: number, a: number, b: number): string {
  const rgb = labToRgb(l, a, b);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, '0');
  return `${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`.toUpperCase();
}

// -- useColor hook -----------------------------------------------------------

/**
 * Hook that encapsulates the full color-analysis pipeline.
 *
 * Usage:
 *   const { analyze, loading, error, clearError, abort, progress } = useColor();
 *   const result = await analyze(photos, "2026年3月");
 */
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
    async (photos: MediaLibrary.Asset[], timeLabel: string): Promise<AnalysisResult> => {
      setLoading(true);
      setError(null);
      setProgress(null);
      abortRef.current = false;

      let processedCount = 0;

      try {
        // -- Step 1: Decode each photo and extract dominant colors (parallel) --
        const allClusters = await processWithConcurrency(
          photos,
          CONCURRENCY,
          async (photo): Promise<ColorCluster[]> => {
            const { pixels, width, height } = await decodeImageToPixels(photo.uri);
            return extractDominantColors(pixels, width, height, 3);
          },
          (current, total) => setProgress({ current, total }),
          abortRef,
        );

        // Filter out empty results and count successes
        const allPhotoClusters: ColorCluster[][] = [];
        for (const clusters of allClusters) {
          if (clusters.length > 0) {
            allPhotoClusters.push(clusters);
            processedCount++;
          }
        }

        // If aborted, bail without error
        if (abortRef.current) {
          throw new Error('__ABORTED__');
        }

        // -- Edge case: no usable photos --------------------------------------
        if (allPhotoClusters.length === 0) {
          throw new Error('没有可分析的照片');
        }

        // -- Step 2: Synthesize cross-photo palette ---------------------------
        const coreColors = synthesizeColorPalette(allPhotoClusters, 5);
        if (coreColors.length === 0) {
          throw new Error('无法生成调色板');
        }

        // -- Step 3: Build gradient stops -------------------------------------
        const gradientColors = buildGradient(coreColors, 12);

        // -- Step 4: Generate caption -----------------------------------------
        const colorDescriptors = coreColors.map((c) => labToHex(c.l, c.a, c.b));
        const caption = await generateCaption(colorDescriptors, timeLabel);

        const result: AnalysisResult = {
          coreColors,
          gradientColors,
          timeLabel,
          caption: caption || `${timeLabel} 的生活底色`,
          photoCount: processedCount,
        };

        return result;
      } catch (err) {
        // Silently propagate abort — no error UI needed
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
