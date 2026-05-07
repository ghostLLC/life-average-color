// src/color/nameColor.ts — Chinese color naming: hex → 诗意颜色名
import { rgbToLab } from './lab';
import type { LabColor } from '../types';

/** A named color entry in our palette database */
interface ColorEntry {
  name: string;  // Chinese color name
  hex: string;   // #RRGGBB
}

/**
 * Traditional Chinese color palette (~120 entries).
 * Curated for poetic, evocative names suitable for social sharing.
 */
const COLOR_DATABASE: ColorEntry[] = [
  // -- 红色系 ---------------------------------------------------------------
  { name: '胭脂', hex: '#E63946' },
  { name: '绛紫', hex: '#8B2346' },
  { name: '嫣红', hex: '#F26B6B' },
  { name: '桃红', hex: '#FBA0A0' },
  { name: '朱砂', hex: '#E84A2D' },
  { name: '珊瑚', hex: '#F88379' },
  { name: '豆沙', hex: '#C77D7D' },
  { name: '妃色', hex: '#F09199' },
  { name: '品红', hex: '#D02090' },
  { name: '银红', hex: '#E88B8B' },
  { name: '枣红', hex: '#96281B' },
  { name: '石榴', hex: '#DC3023' },

  // -- 橙黄色系 -------------------------------------------------------------
  { name: '杏黄', hex: '#F0A35E' },
  { name: '秋香', hex: '#D9B611' },
  { name: '琥珀', hex: '#CA6924' },
  { name: '橘红', hex: '#FF6B35' },
  { name: '姜黄', hex: '#E2B13C' },
  { name: '鹅黄', hex: '#FFF143' },
  { name: '缃色', hex: '#DBA42A' },
  { name: '驼色', hex: '#C8A27A' },
  { name: '柿色', hex: '#F28C38' },
  { name: '蜜合', hex: '#F0C27A' },
  { name: '金盏', hex: '#F4A83D' },
  { name: '落日', hex: '#E8863F' },

  // -- 绿色系 ---------------------------------------------------------------
  { name: '柳绿', hex: '#A0C55F' },
  { name: '竹青', hex: '#5B8930' },
  { name: '葱绿', hex: '#98D048' },
  { name: '翡翠', hex: '#3CB371' },
  { name: '碧色', hex: '#1ABC9C' },
  { name: '松花', hex: '#C0D67A' },
  { name: '苔色', hex: '#798C5E' },
  { name: '艾绿', hex: '#A4C98A' },
  { name: '莲青', hex: '#218868' },
  { name: '石绿', hex: '#40A070' },
  { name: '青矾', hex: '#2E7D5B' },
  { name: '薄荷', hex: '#7FCEB0' },

  // -- 蓝色系 ---------------------------------------------------------------
  { name: '靛蓝', hex: '#1E3E62' },
  { name: '藏蓝', hex: '#2C3892' },
  { name: '天蓝', hex: '#4A90D9' },
  { name: '霁色', hex: '#5B8FB9' },
  { name: '月白', hex: '#D6E4F0' },
  { name: '宝蓝', hex: '#3452A1' },
  { name: '湖蓝', hex: '#30A0C0' },
  { name: '蔚蓝', hex: '#5DADE2' },
  { name: '星蓝', hex: '#3C5A9A' },
  { name: '琉璃', hex: '#1A5B8C' },
  { name: '雾蓝', hex: '#8BA5C8' },
  { name: '深海', hex: '#0B2D5B' },

  // -- 紫色系 ---------------------------------------------------------------
  { name: '藕荷', hex: '#C4A0C4' },
  { name: '丁香', hex: '#B598C6' },
  { name: '青莲', hex: '#8B3A8B' },
  { name: '雪青', hex: '#A07EB3' },
  { name: '葡萄', hex: '#604878' },
  { name: '暮紫', hex: '#74609E' },
  { name: '薰衣', hex: '#B0A0D0' },
  { name: '紫檀', hex: '#4C294F' },
  { name: '鸢尾', hex: '#7040A0' },
  { name: '苋紫', hex: '#8B2671' },

  // -- 中性 / 大地色系 -------------------------------------------------------
  { name: '鸦青', hex: '#3C4142' },
  { name: '墨色', hex: '#1A1A2E' },
  { name: '霜色', hex: '#E0E0E0' },
  { name: '素色', hex: '#F4F0E8' },
  { name: '玄青', hex: '#2B2B2B' },
  { name: '烟灰', hex: '#8E8E8E' },
  { name: '暖灰', hex: '#B5AFA7' },
  { name: '茶色', hex: '#A87B5D' },
  { name: '栗色', hex: '#68452D' },
  { name: '檀色', hex: '#B78662' },
  { name: '卡其', hex: '#C3B091' },
  { name: '沙色', hex: '#D2B48C' },
  { name: '米白', hex: '#F5F0E1' },
  { name: '奶白', hex: '#FFF9E8' },
  { name: '象牙', hex: '#FFFFF0' },
  { name: '雪白', hex: '#F9F9F9' },
  { name: '铅灰', hex: '#757575' },
  { name: '炭灰', hex: '#484848' },
];

// ============================================================================
// Color distance
// ============================================================================

/** Euclidean distance in LAB space (perceptually uniform) */
function labDistance(a: LabColor, b: LabColor): number {
  const dl = a.l - b.l;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return Math.sqrt(dl * dl + da * da + db * db);
}

// ============================================================================
// Public API
// ============================================================================

export interface NamedColor {
  hex: string;     // e.g. "#E63946"
  name: string;    // e.g. "胭脂"
  ratio?: number;  // 0-1, proportion of this color in the palette (optional)
}

/**
 * Find the closest traditional Chinese color name for a given hex color.
 * Uses LAB color space for perceptually accurate distance measurement.
 *
 * @param hex — "#RRGGBB" hex string (from labToHex in useColor.ts)
 * @returns the closest NamedColor from our database
 */
export function nameColor(hex: string): NamedColor {
  // Convert hex → RGB → LAB
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const targetLab = rgbToLab(r, g, b);

  let best: ColorEntry | null = null;
  let bestDist = Infinity;

  for (const entry of COLOR_DATABASE) {
    const er = parseInt(entry.hex.slice(1, 3), 16);
    const eg = parseInt(entry.hex.slice(3, 5), 16);
    const eb = parseInt(entry.hex.slice(5, 7), 16);
    const entryLab = rgbToLab(er, eg, eb);
    const dist = labDistance(targetLab, entryLab);

    if (dist < bestDist) {
      bestDist = dist;
      best = entry;
    }
  }

  // Fallback (should never happen with a populated database)
  if (!best) return { hex: `#${hex}`, name: '自定义' };

  return { hex: `#${hex}`, name: best.name };
}

/**
 * Name an array of hex colors. Returns NamedColor[].
 */
export function nameColors(hexes: string[]): NamedColor[] {
  return hexes.map((h) => nameColor(h));
}
