import React, { useImperativeHandle, useRef, forwardRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import ViewShot, { ViewShotRef } from 'react-native-view-shot';

import type { NamedColor } from '../types';

/**
 * Compute the position (0..1) of core color i along the diagonal gradient,
 * then map to percentage-based top/left for absolute placement.
 */
function labelPosition(i: number, total: number) {
  const pos = total <= 1 ? 0.5 : i / (total - 1);
  return {
    top: `${8 + pos * 55}%` as const,
    left: `${8 + pos * 58}%` as const,
  };
}

// -- Public handle exposed via ref --------------------------------------------

export interface CardViewHandle {
  capture: () => Promise<string>;
}

// -- Props -------------------------------------------------------------------

export interface CardViewProps {
  gradientColors: string[];
  timeLabel: string;
  caption: string;
  namedColors?: NamedColor[];
  onCapture?: (uri: string) => void;
}

// -- Dimensions --------------------------------------------------------------

const HORIZONTAL_PADDING = 100; // 50px per side — card at ~72% screen width
const ASPECT_RATIO = 1.55;

// -- Component ---------------------------------------------------------------

function CardView(
  { gradientColors, timeLabel, caption, namedColors, onCapture }: CardViewProps,
  ref: React.Ref<CardViewHandle>,
) {
  const viewShotRef = useRef<ViewShotRef>(null);
  const { width: screenWidth } = useWindowDimensions();

  const cardWidth = screenWidth - HORIZONTAL_PADDING;
  const cardHeight = cardWidth * ASPECT_RATIO;

  // Ensure at least 2 colors for LinearGradient
  const safeColors: (string | number)[] =
    gradientColors.length >= 2
      ? gradientColors
      : ['#1a1a2e', '#16213e'];

  // -- Expose imperative capture method --------------------------------------
  useImperativeHandle(ref, () => ({
    capture: async () => {
      const uri = await viewShotRef.current?.capture();
      if (uri) {
        onCapture?.(uri);
      }
      return uri ?? '';
    },
  }));

  return (
    <ViewShot
      ref={viewShotRef}
      options={{ format: 'png', quality: 1 }}
      style={[styles.viewShot, { width: cardWidth, height: cardHeight }]}
    >
      <LinearGradient
        colors={safeColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Core color labels — positioned on their gradient zones */}
        {namedColors && namedColors.length > 0 && (() => {
          const ratios = namedColors.map((nc) => nc.ratio ?? 1 / namedColors.length);
          const maxRatio = Math.max(...ratios);
          const minRatio = Math.min(...ratios);
          const range = maxRatio - minRatio || 1;
          return namedColors.map((nc, i) => {
            const pos = labelPosition(i, namedColors.length);
            const ratio = nc.ratio ?? 1 / namedColors.length;
            const pct = Math.round(ratio * 100);
            // Scale factor: dominant color gets 1.25, smallest gets 0.75
            const scale = 0.75 + ((ratio - minRatio) / range) * 0.5;
            const nameSize = Math.round(20 * scale);
            const pctSize = Math.round(14 * scale);
            return (
              <View key={i} style={[styles.colorLabel, { top: pos.top, left: pos.left }]}>
                <View style={styles.colorLabelRow}>
                  <Text style={[styles.colorLabelName, { color: nc.hex, fontSize: nameSize }]}>
                    {nc.name}
                  </Text>
                  <Text style={[styles.colorLabelPct, { color: nc.hex, fontSize: pctSize }]}>
                    {pct}%
                  </Text>
                </View>
                <Text style={[styles.colorLabelHex, { color: nc.hex }]}>{nc.hex}</Text>
              </View>
            );
          });
        })()}

        {/* Spacer pushes text overlay to bottom */}
        <View style={{ flex: 1 }} />

        {/* Frosted glass text overlay at the bottom */}
        <View style={styles.textOverlay}>
          <Text style={styles.timeLabel}>{timeLabel}</Text>
          <Text style={styles.caption}>{caption}</Text>
        </View>
      </LinearGradient>
    </ViewShot>
  );
}

// -- Forward ref wrapper -----------------------------------------------------

const CardViewWithRef = forwardRef(CardView);
export default CardViewWithRef;

// -- CardPreview: convenience wrapper for AnalysisResult ---------------------

export interface CardPreviewProps {
  gradientColors: string[];
  timeLabel: string;
  caption: string;
  namedColors?: NamedColor[];
  onCapture?: (uri: string) => void;
}

export function CardPreview({
  gradientColors,
  timeLabel,
  caption,
  namedColors,
  onCapture,
}: CardPreviewProps) {
  const cardRef = useRef<CardViewHandle>(null);

  return (
    <View style={styles.previewContainer}>
      <CardViewWithRef
        ref={cardRef}
        gradientColors={gradientColors}
        timeLabel={timeLabel}
        caption={caption}
        namedColors={namedColors}
        onCapture={onCapture}
      />
    </View>
  );
}

// -- Styles ------------------------------------------------------------------

const styles = StyleSheet.create({
  viewShot: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  // Color labels (absolutely positioned on gradient)
  colorLabel: {
    position: 'absolute',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  colorLabelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  colorLabelName: {
    fontWeight: '800',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  colorLabelPct: {
    fontWeight: '600',
    letterSpacing: 1,
    opacity: 0.6,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  colorLabelHex: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.5,
    marginTop: 2,
    opacity: 0.55,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 5,
  },
  // Text overlay
  textOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  timeLabel: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  caption: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
  },
  previewContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
});
