import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';

// -- Props ---------------------------------------------------------------------

interface AnalysisAnimationProps {
  progress: { current: number; total: number };
  phase?: 'idle' | 'running';
}

// -- Constants -----------------------------------------------------------------

const DOT_COUNT = 12;
const COLORS = [
  '#e94560', '#f0a35e', '#a0c55f', '#4a90d9',
  '#8b3a8b', '#e2b13c', '#3cb371', '#5b8fb9',
  '#dc3023', '#c4a0c4', '#1abc9c', '#ff6b35',
];

// -- Component -----------------------------------------------------------------

export default function AnalysisAnimation({ progress, phase }: AnalysisAnimationProps) {
  const progressRatio = progress.total > 0 ? progress.current / progress.total : 0;
  const percent = Math.round(progressRatio * 100);

  // Determine narrative phase
  const stage = percent < 30 ? 'reading' : percent < 70 ? 'extracting' : 'blending';

  // -- Animated values --
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pulsing center ring
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();

    // Rotating outer ring
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [pulseAnim, rotateAnim]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // -- Floating color dots --
  const dots = useMemo(() => {
    return Array.from({ length: DOT_COUNT }, (_, i) => {
      const angle = (i / DOT_COUNT) * Math.PI * 2;
      const radius = 90 + Math.sin(i * 2.3) * 20;
      // Dots converge toward center as progress increases
      const convergeR = radius * (1 - progressRatio * 0.6);
      const x = Math.cos(angle) * convergeR;
      const y = Math.sin(angle) * convergeR;
      return {
        x,
        y,
        color: COLORS[i % COLORS.length],
        size: 6 + (progressRatio > 0.6 ? (1 - progressRatio) * 6 : 3),
      };
    });
  }, [progressRatio]);

  // -- Stage descriptor --
  const stageText = stage === 'reading'
    ? '正在读取每张照片'
    : stage === 'extracting'
    ? '正在提取核心色彩'
    : '正在合成渐变调色板';

  const stageHint = stage === 'reading'
    ? '逐张解析照片中的颜色分布'
    : stage === 'extracting'
    ? 'K-means 聚类提取最具代表性的色调'
    : 'LAB 空间插值融合为最终色系';

  return (
    <View style={styles.container}>
      {/* Outer rotating ring */}
      <Animated.View style={[styles.outerRing, { transform: [{ rotate }] }]}>
        <View style={styles.ringDot} />
      </Animated.View>

      {/* Floating color dots */}
      <View style={styles.dotsContainer}>
        {dots.map((dot, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: dot.color,
                width: dot.size,
                height: dot.size,
                borderRadius: dot.size / 2,
                transform: [
                  { translateX: dot.x },
                  { translateY: dot.y },
                ],
                opacity: 0.7 + (progressRatio * 0.3),
              },
            ]}
          />
        ))}
      </View>

      {/* Center pulsing ring */}
      <Animated.View style={[styles.centerRing, { transform: [{ scale: pulseAnim }] }]}>
        <View style={styles.centerCore}>
          <Text style={styles.percentText}>{percent}%</Text>
        </View>
      </Animated.View>

      {/* Phase text */}
      <Text style={styles.stageText}>{stageText}</Text>
      <Text style={styles.stageHint}>{stageHint}</Text>

      {/* Mini progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: `${percent}%` }]} />
      </View>

      {/* Photo count */}
      <Text style={styles.countText}>
        {progress.current} / {progress.total} 张
      </Text>
    </View>
  );
}

// -- Styles --------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 260,
    height: 300,
  },

  // Outer ring
  outerRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(233, 69, 96, 0.15)',
    borderStyle: 'dashed',
  },
  ringDot: {
    position: 'absolute',
    top: -3,
    left: '50%',
    marginLeft: -3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e94560',
  },

  // Color dots
  dotsContainer: {
    position: 'absolute',
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
  },

  // Center
  centerRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: 'rgba(233, 69, 96, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  centerCore: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(233, 69, 96, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // Text
  stageText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 120,
  },
  stageHint: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    letterSpacing: 1,
    marginTop: 6,
  },

  // Progress
  progressTrack: {
    width: 180,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 1,
    overflow: 'hidden',
    marginTop: 18,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#e94560',
    borderRadius: 1,
  },

  countText: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 12,
    marginTop: 8,
    letterSpacing: 1,
  },
});
