// src/color/decodeImage.ts — Decode image files to raw RGBA pixel data
// Uses @bam.tech/react-native-image-resizer + react-native-fs + pako (pure JS zlib).
import ImageResizer from '@bam.tech/react-native-image-resizer';
import RNFS from 'react-native-fs';
import { inflate } from 'pako';

export interface DecodedImage {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Decode a PNG byte array into raw RGBA pixels.
 *
 * PNG chunk parsing + unfilter → self-contained.
 * zlib decompression → delegated to pako (pure JS, works everywhere).
 */
function decodePNG(data: Uint8Array): DecodedImage {
  // Check PNG signature
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (data[i] !== sig[i]) throw new Error('Not a PNG file');
  }

  let pos = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 8;
  let colorType = 6;
  let palette: Uint8Array | null = null;
  const idatChunks: Uint8Array[] = [];
  let totalIdatLen = 0;

  // -- Parse chunks ---------------------------------------------------------
  while (pos < data.length) {
    const len =
      (data[pos] << 24) | (data[pos + 1] << 16) | (data[pos + 2] << 8) | data[pos + 3];
    const type = String.fromCharCode(
      data[pos + 4], data[pos + 5], data[pos + 6], data[pos + 7],
    );

    if (type === 'IHDR') {
      width =
        (data[pos + 8] << 24) | (data[pos + 9] << 16) |
        (data[pos + 10] << 8) | data[pos + 11];
      height =
        (data[pos + 12] << 24) | (data[pos + 13] << 16) |
        (data[pos + 14] << 8) | data[pos + 15];
      bitDepth = data[pos + 16];
      colorType = data[pos + 17];
    }

    if (type === 'PLTE') {
      palette = data.slice(pos + 8, pos + 8 + len);
    }

    if (type === 'IDAT') {
      idatChunks.push(data.slice(pos + 8, pos + 8 + len));
      totalIdatLen += len;
    }

    if (type === 'IEND') break;

    pos += 12 + len; // 4(len) + 4(type) + len(data) + 4(crc)
  }

  if (width === 0 || height === 0) throw new Error('Invalid PNG: no IHDR');

  // -- Concatenate IDAT chunks ----------------------------------------------
  const compressed = new Uint8Array(totalIdatLen);
  let off = 0;
  for (const chunk of idatChunks) {
    compressed.set(chunk, off);
    off += chunk.length;
  }

  // -- Decompress with pako (pure JS zlib) ----------------------------------
  const rawPixels = inflate(compressed);

  // -- PNG unfilter ---------------------------------------------------------
  const channels = colorType === 2 ? 3 : colorType === 0 ? 1 : 4;
  const stride = ((width * channels * bitDepth) / 8) + 1; // +1 for filter byte

  // In-place unfilter: modify rawPixels as we go
  for (let y = 0; y < height; y++) {
    const rowOff = y * stride;
    const filterType = rawPixels[rowOff];
    const rowStart = rowOff + 1;

    for (let x = 0; x < width * channels; x++) {
      const byte = rawPixels[rowStart + x];
      const left = x >= channels ? rawPixels[rowStart + x - channels] : 0;
      const up = y > 0 ? rawPixels[rowStart - stride + x] : 0;
      const upLeft = (y > 0 && x >= channels) ? rawPixels[rowStart - stride + x - channels] : 0;

      let val: number;
      switch (filterType) {
        case 0: val = byte; break;
        case 1: val = byte + left; break;
        case 2: val = byte + up; break;
        case 3: val = byte + Math.floor((left + up) / 2); break;
        case 4: {
          const p = left + up - upLeft;
          const pLeft = Math.abs(p - left);
          const pUp = Math.abs(p - up);
          const pUpLeft = Math.abs(p - upLeft);
          const minDist = Math.min(pLeft, pUp, pUpLeft);
          val = byte + (minDist === pLeft ? left : minDist === pUp ? up : upLeft);
          break;
        }
        default: val = byte;
      }
      rawPixels[rowStart + x] = val & 0xff;
    }
  }

  // -- Build RGBA output ----------------------------------------------------
  const rgba = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    const rowStart = y * stride + 1; // skip filter byte
    for (let x = 0; x < width; x++) {
      const outIdx = (y * width + x) * 4;

      if (colorType === 0) {
        // Grayscale
        const v = rawPixels[rowStart + x];
        rgba[outIdx] = v;
        rgba[outIdx + 1] = v;
        rgba[outIdx + 2] = v;
        rgba[outIdx + 3] = 255;
      } else if (colorType === 2) {
        // RGB
        rgba[outIdx] = rawPixels[rowStart + x * 3];
        rgba[outIdx + 1] = rawPixels[rowStart + x * 3 + 1];
        rgba[outIdx + 2] = rawPixels[rowStart + x * 3 + 2];
        rgba[outIdx + 3] = 255;
      } else if (colorType === 3 && palette) {
        // Indexed
        const idx = rawPixels[rowStart + x];
        rgba[outIdx] = palette[idx * 3];
        rgba[outIdx + 1] = palette[idx * 3 + 1];
        rgba[outIdx + 2] = palette[idx * 3 + 2];
        rgba[outIdx + 3] = 255;
      } else {
        // RGBA
        rgba[outIdx] = rawPixels[rowStart + x * 4];
        rgba[outIdx + 1] = rawPixels[rowStart + x * 4 + 1];
        rgba[outIdx + 2] = rawPixels[rowStart + x * 4 + 2];
        rgba[outIdx + 3] = rawPixels[rowStart + x * 4 + 3];
      }
    }
  }

  return { pixels: rgba, width, height };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Decode a local image URI into raw RGBA pixel data.
 *
 * Uses @bam.tech/react-native-image-resizer + react-native-fs for thumbnail,
 */
export async function decodeImageToPixels(uri: string): Promise<DecodedImage> {
  // Step 1: Resize to thumbnail via ImageResizer
  const resized = await ImageResizer.createResizedImage(uri, 200, 9999, 'PNG', 100, 0, undefined);

  // Step 2: Read resized file as base64
  const base64 = await RNFS.readFile(resized.path, 'base64');

  // Step 3: Convert base64 to Uint8Array
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Step 4: Decode PNG
  return decodePNG(bytes);
}
