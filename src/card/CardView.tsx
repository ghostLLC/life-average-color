import React, { useImperativeHandle, useRef, forwardRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ViewShot, { ViewShotRef } from 'react-native-view-shot';

import type { NamedColor } from '../types';

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

const HORIZONTAL_PADDING = 48; // 24px on each side
const ASPECT_RATIO = 1.6; // height = width * 1.6 (5:8 portrait)

// -- Component ---------------------------------------------------------------

function CardView(
  { gradientColors, timeLabel, caption, namedColors, onCapture }: CardViewProps,
  ref: React.Ref<CardViewHandle>,
) {
  const viewShotRef = useRef<ViewShotRef>(null);
  const { width: screenWidth } = useWindowDimensions();

  const cardWidth = screenWidth - HORIZONTAL_PADDING;
  const cardHeight = cardWidth * ASPECT_RATIO;

  // Ensure at least 2 colors for LinearGradient (type-safe fallback)
  const safeColors: readonly [string, string, ...string[]] =
    gradientColors.length >= 2
      ? (gradientColors as [string, string, ...string[]])
      : (['#1a1a2e', '#16213e'] as const);

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
        {/* Color swatches at the top */}
        {namedColors && namedColors.length > 0 && (
          <View style={styles.swatchRow}>
            {namedColors.map((nc, i) => (
              <View key={i} style={styles.swatchItem}>
                <View
                  style={[styles.swatchDot, { backgroundColor: nc.hex }]}
                />
                <Text style={styles.swatchName}>{nc.name}</Text>
                <Text style={styles.swatchHex}>{nc.hex}</Text>
              </View>
            ))}
          </View>
        )}

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
  // Swatches
  swatchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 18,
    paddingHorizontal: 16,
    flexWrap: 'wrap',
  },
  swatchItem: {
    alignItems: 'center',
    minWidth: 52,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  swatchDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  swatchName: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  swatchHex: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
    marginTop: 2,
    letterSpacing: 0.3,
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
