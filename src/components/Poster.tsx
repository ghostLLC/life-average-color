import React, { useImperativeHandle, useRef, forwardRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import ViewShot, { ViewShotRef } from 'react-native-view-shot';

import type { NamedColor, RecommendedPhoto } from '../types';

export interface PosterHandle {
  capture: () => Promise<string>;
}

export interface PosterProps {
  gradientColors: string[];
  namedColors: NamedColor[];
  timeLabel: string;
  caption: string;
  recommendedPhotos: RecommendedPhoto[];
}

const ASPECT = 1.9;

function Poster(
  { gradientColors, namedColors, timeLabel, caption, recommendedPhotos }: PosterProps,
  ref: React.Ref<PosterHandle>,
) {
  const viewShotRef = useRef<ViewShotRef>(null);
  const { width: screenW } = useWindowDimensions();
  const posterW = screenW - 40;
  const posterH = posterW * ASPECT;
  const safeColors: (string | number)[] =
    gradientColors.length >= 2 ? gradientColors : ['#1a1a2e', '#16213e'];

  useImperativeHandle(ref, () => ({
    capture: async () => (await viewShotRef.current?.capture()) ?? '',
  }));

  const ratios = namedColors.map((c) => c.ratio ?? 1 / namedColors.length);
  const maxR = Math.max(...ratios);
  const photoSize = posterW / 3.5;

  return (
    <ViewShot
      ref={viewShotRef}
      options={{ format: 'png', quality: 1 }}
      style={[styles.shot, { width: posterW, height: posterH }]}
    >
      <LinearGradient colors={safeColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bg}>
        {/* Branding */}
        <View style={styles.brandRow}>
          <Image source={require('../../assets/icon.png')} style={styles.brandIcon} resizeMode="contain" />
          <View>
            <Text style={styles.brandTitle}>生活平均色</Text>
            <Text style={styles.brandSub}>你的相册，调成一杯莫吉托的颜色</Text>
          </View>
        </View>

        {/* Gradient area with floating color labels */}
        <View style={styles.gradientArea}>
          <LinearGradient colors={safeColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradientFill}>
            {namedColors.map((nc, i) => {
              const n = namedColors.length;
              const r = nc.ratio ?? 1 / n;
              const cumulative = namedColors.slice(0, i).reduce((s, c) => s + (c.ratio ?? 1 / n), 0);
              const pos = n <= 1 ? 0.45 : cumulative + r / 2;
              const topPct = `${5 + pos * 50}%` as const;
              const leftPct = `${5 + pos * 50}%` as const;
              const scale = 0.75 + (r / maxR) * 0.25;
              const pct = Math.round(r * 100);
              return (
                <View key={i} style={[styles.colorLabel, { top: topPct, left: leftPct }]}>
                  <Text style={[styles.colorName, { color: nc.hex, fontSize: Math.round(26 * scale) }]}>
                    {nc.name}
                  </Text>
                  <Text style={[styles.colorPct, { color: nc.hex }]}>
                    {pct}%  {nc.hex}
                  </Text>
                </View>
              );
            })}
          </LinearGradient>

          {/* Text overlay at bottom of gradient */}
          <View style={styles.textOverlay}>
            <Text style={styles.timeLabel}>{timeLabel}</Text>
            <Text style={styles.captionText}>{caption}</Text>
          </View>
        </View>

        {/* Photos */}
        {recommendedPhotos.length > 0 && (
          <View style={styles.photosSection}>
            <View style={styles.sectionDivider} />
            <Text style={styles.photosTitle}>最接近平均色的瞬间</Text>
            <View style={styles.photosRow}>
              {recommendedPhotos.slice(0, 3).map((rp, i) => (
                <Image
                  key={i}
                  source={{ uri: rp.uri }}
                  style={[styles.photoThumb, { width: photoSize, height: photoSize, borderRadius: photoSize / 5 }]}
                  resizeMode="cover"
                />
              ))}
            </View>
          </View>
        )}

        {/* Watermark */}
        <View style={styles.watermarkRow}>
          <View style={styles.watermarkLine} />
          <Text style={styles.watermarkText}>生活平均色</Text>
          <View style={styles.watermarkLine} />
        </View>
      </LinearGradient>
    </ViewShot>
  );
}

const PosterWithRef = forwardRef(Poster);
export default PosterWithRef;

const styles = StyleSheet.create({
  shot: { borderRadius: 32, overflow: 'hidden' },
  bg: { flex: 1, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 24 },

  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  brandIcon: { width: 44, height: 44, borderRadius: 12 },
  brandTitle: { color: '#ffffff', fontSize: 20, fontWeight: '800', letterSpacing: 3 },
  brandSub: { color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 3 },

  // Gradient + floating labels
  gradientArea: { flex: 1, marginVertical: 14, borderRadius: 20, overflow: 'hidden' },
  gradientFill: { flex: 1 },
  colorLabel: { position: 'absolute', paddingVertical: 6, paddingHorizontal: 4 },
  colorName: {
    fontWeight: '800',
    letterSpacing: 3,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  colorPct: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    marginTop: 3,
    opacity: 0.7,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },

  textOverlay: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  timeLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  captionText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
  },

  photosSection: { alignItems: 'center', marginTop: 4 },
  sectionDivider: {
    width: 40, height: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 1,
    marginBottom: 10,
  },
  photosTitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    letterSpacing: 3,
    marginBottom: 10,
  },
  photosRow: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  photoThumb: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)' },

  watermarkRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  watermarkLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.15)' },
  watermarkText: { color: 'rgba(255,255,255,0.3)', fontSize: 11, letterSpacing: 3 },
});
