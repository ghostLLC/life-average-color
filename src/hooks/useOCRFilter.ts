import { useCallback, useRef, useState } from 'react';
// @ts-ignore — no TS types for this package
import TextRecognition from '@react-native-ml-kit/text-recognition';

export interface OCRResult {
  flaggedUris: Set<string>;
  textBlockCounts: Record<string, number>;
}

export interface UseOCRFilterResult {
  filter: (
    uris: string[],
    onPhotoScanned?: (uri: string, isFlagged: boolean) => void,
  ) => Promise<OCRResult>;
  loading: boolean;
  progress: { current: number; total: number } | null;
  abort: () => void;
}

/** A photo is likely a screenshot if ML Kit finds > 12 text blocks. */
function isScreenshot(blockCount: number): boolean {
  return blockCount > 12;
}

function countBlocks(blocks: Record<string, unknown>[]): number {
  let count = blocks.length;
  for (const b of blocks) {
    const lines = (b as any).lines;
    if (Array.isArray(lines) && lines.length > 0) {
      count += lines.length;
    }
  }
  return count;
}

export function useOCRFilter(): UseOCRFilterResult {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const abortRef = useRef(false);

  const abort = useCallback(() => { abortRef.current = true; }, []);

  const filter = useCallback(async (
    uris: string[],
    onPhotoScanned?: (uri: string, isFlagged: boolean) => void,
  ): Promise<OCRResult> => {
    setLoading(true);
    setProgress({ current: 0, total: uris.length });
    abortRef.current = false;
    const flaggedUris = new Set<string>();
    const textBlockCounts: Record<string, number> = {};

    for (let i = 0; i < uris.length; i++) {
      if (abortRef.current) break;
      const uri = uris[i];
      let flagged = false;
      try {
        const result: any = await TextRecognition.recognize(uri);
        const blocks = countBlocks(result.blocks || []);
        textBlockCounts[uri] = blocks;
        if (isScreenshot(blocks)) {
          flaggedUris.add(uri);
          flagged = true;
        }
      } catch {
        // OCR failed — treat as clean
      }
      // Fire per-photo callback immediately so UI updates in real-time
      onPhotoScanned?.(uri, flagged);
      setProgress({ current: i + 1, total: uris.length });
    }

    setLoading(false);
    setProgress(null);
    return { flaggedUris, textBlockCounts };
  }, []);

  return { filter, loading, progress, abort };
}
