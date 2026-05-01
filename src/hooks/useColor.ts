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

export interface UseColorResult {
  /** Run the full analysis pipeline against the given photos */
  analyze: (photos: MediaLibrary.Asset[], timeLabel: string) => Promise<AnalysisResult>;
  /** Whether analysis is currently in progress */
  loading: boolean;
  /** Error message if the last analysis failed, null otherwise */
  error: string | null;
  /** Clear the current error state */
  clearError: () => void;
}

/** Convert a LabColor to a hex string like "#FF6B35" */
function labToHex(l: number, a: number, b: number): string {
  const rgb = labToRgb(l, a, b);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, '0');
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`.toUpperCase();
}

/**
 * Hook that encapsulates the full color-analysis pipeline.
 *
 * Usage:
 *   const { analyze, loading, error, clearError } = useColor();
 *   const result = await analyze(photos, "2026年3月");
 */
export function useColor(): UseColorResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  const clearError = useCallback(() => setError(null), []);

  const analyze = useCallback(
    async (photos: MediaLibrary.Asset[], timeLabel: string): Promise<AnalysisResult> => {
      setLoading(true);
      setError(null);
      abortRef.current = false;

      try {
        // -- Step 1: Decode each photo and extract dominant colors -------------
        const allPhotoClusters: ColorCluster[][] = [];

        for (let i = 0; i < photos.length; i++) {
          if (abortRef.current) break;

          try {
            const { pixels, width, height } = await decodeImageToPixels(photos[i].uri);
            const clusters = extractDominantColors(pixels, width, height, 3);
            if (clusters.length > 0) {
              allPhotoClusters.push(clusters);
            }
          } catch (err) {
            // Skip individual photo decode failures — don't fail the whole batch
            console.warn(`[useColor] Skipping photo ${i}:`, err);
          }
        }

        // -- Edge case: no usable photos ---------------------------------------
        if (allPhotoClusters.length === 0) {
          throw new Error('没有可分析的照片');
        }

        // -- Step 2: Synthesize cross-photo palette ----------------------------
        const coreColors = synthesizeColorPalette(allPhotoClusters, 5);
        if (coreColors.length === 0) {
          throw new Error('无法生成调色板');
        }

        // -- Step 3: Build gradient stops --------------------------------------
        const gradientColors = buildGradient(coreColors, 12);

        // -- Step 4: Generate caption ------------------------------------------
        const colorDescriptors = coreColors.map((c) => labToHex(c.l, c.a, c.b));
        const caption = await generateCaption(colorDescriptors, timeLabel);

        const result: AnalysisResult = {
          coreColors,
          gradientColors,
          timeLabel,
          caption: caption || `${timeLabel} 的生活底色`,
          photoCount: photos.length,
        };

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : '分析失败，请重试';
        if (!abortRef.current) {
          setError(message);
        }
        throw err;
      } finally {
        if (!abortRef.current) {
          setLoading(false);
        }
      }
    },
    [],
  );

  return { analyze, loading, error, clearError };
}
