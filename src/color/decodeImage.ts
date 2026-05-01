// src/color/decodeImage.ts — Decode image files to raw RGBA pixel data
import * as ImageManipulator from 'expo-image-manipulator';
import { PNG } from 'pngjs';
import { decode as jpegDecode } from 'jpeg-js';

export interface DecodedImage {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Decode a local image URI into raw RGBA pixel data.
 *
 * Strategy:
 *   1. Use expo-image-manipulator to resize to max 200px wide
 *      and convert to base64 PNG (small + consistent format).
 *   2. Decode the base64 PNG using pngjs into raw pixels.
 *
 * Falls back to JPEG decoding via jpeg-js if PNG parsing fails
 * (handles edge cases where the manipulator returns JPEG data).
 *
 * @param uri  Local file URI from expo-media-library asset.
 * @returns    { pixels, width, height } suitable for extractDominantColors.
 */
export async function decodeImageToPixels(uri: string): Promise<DecodedImage> {
  // -- Step 1: Resize to thumbnail and get base64 -----------------------------
  const manipResult = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 200 } }],
    { format: ImageManipulator.SaveFormat.PNG, base64: true },
  );

  if (!manipResult.base64) {
    throw new Error('ImageManipulator returned no base64 data');
  }

  const buffer = Buffer.from(manipResult.base64, 'base64');

  // -- Step 2: Try PNG first (our requested format) ---------------------------
  try {
    const png = PNG.sync.read(buffer);
    return {
      pixels: new Uint8ClampedArray(png.data),
      width: png.width,
      height: png.height,
    };
  } catch {
    // PNG parse failed — try JPEG
  }

  // -- Step 3: Fallback to JPEG -----------------------------------------------
  try {
    const raw = jpegDecode(buffer);
    return {
      pixels: new Uint8ClampedArray(raw.data),
      width: raw.width,
      height: raw.height,
    };
  } catch {
    throw new Error('Failed to decode image: neither PNG nor JPEG');
  }
}
