import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';

interface Props {
  progress: { current: number; total: number };
  phase?: 'idle' | 'running';
}

const { width: SW } = Dimensions.get('window');
const SIZE = 240;

const PALETTE = [
  '#C9745B', '#D4916A', '#E0A87D', '#B8956E',
  '#9B8EC4', '#7BA5C8', '#6DB5A0', '#8CB896',
  '#D4856B', '#C38E70', '#8AA4B8', '#A891B0',
  '#CC9C7C', '#918BB0', '#6EA8A0', '#B8877E',
  '#D9A38C', '#8DA0B5', '#A0B880', '#C28E8A',
];

// -- Individual animated blob -------------------------------------------------

function Blob({ index, progressRatio }: { index: number; progressRatio: number }) {
  const baseAngle = (index / 20) * Math.PI * 2;
  const hue = PALETTE[index % PALETTE.length];

  // Orbital speed varies per blob
  const orbitSpeed = 12000 + index * 700;
  const pulseSpeed = 3000 + index * 500;

  const orbitAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const orbit = Animated.loop(Animated.timing(orbitAnim, {
      toValue: 1, duration: orbitSpeed, easing: Easing.linear, useNativeDriver: true,
    }));
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1, duration: pulseSpeed / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 0, duration: pulseSpeed / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    orbit.start(); pulse.start();
    return () => { orbit.stop(); pulse.stop(); };
  }, []);

  const maxR = 80 + Math.sin(index * 1.3) * 30;
  const radius = maxR * (1 - progressRatio * 0.75);

  // Pre-compute orbital positions using sine/cosine via interpolation
  const angleRad = baseAngle + Math.PI * 2;
  const xInput = orbitAnim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [
      Math.cos(baseAngle) * radius,
      Math.cos(baseAngle + Math.PI / 2) * radius,
      Math.cos(baseAngle + Math.PI) * radius,
      Math.cos(baseAngle + Math.PI * 1.5) * radius,
      Math.cos(angleRad) * radius,
    ],
  });
  const yInput = orbitAnim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [
      Math.sin(baseAngle) * radius,
      Math.sin(baseAngle + Math.PI / 2) * radius,
      Math.sin(baseAngle + Math.PI) * radius,
      Math.sin(baseAngle + Math.PI * 1.5) * radius,
      Math.sin(angleRad) * radius,
    ],
  });

  const size = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [4 + Math.sin(index) * 3, 8 + Math.sin(index) * 3],
  });

  const opacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.75],
  });

  return (
    <Animated.View
      style={[
        styles.blob,
        {
          backgroundColor: hue,
          width: size,
          height: size,
          borderRadius: 50,
          opacity,
          transform: [{ translateX: xInput }, { translateY: yInput }],
        },
      ]}
    />
  );
}

// -- Main component -----------------------------------------------------------

export default function AnalysisAnimation({ progress }: Props) {
  const ratio = progress.total > 0 ? progress.current / progress.total : 0;

  const haloPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(haloPulse, { toValue: 1.12, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(haloPulse, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();
  }, [haloPulse]);

  const blobs = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => (
      <Blob key={i} index={i} progressRatio={ratio} />
    )), [ratio],
  );

  return (
    <View style={styles.container}>
      {/* Halo */}
      <Animated.View style={[styles.halo, { transform: [{ scale: haloPulse }], opacity: 0.08 + ratio * 0.1 }]} />

      {/* Inner ring */}
      <Animated.View style={[styles.innerRing, { transform: [{ scale: haloPulse }], opacity: 0.2 + ratio * 0.15 }]} />

      {/* Blobs */}
      <View style={styles.blobLayer}>
        {blobs}
      </View>

      {/* Center glow */}
      <Animated.View style={[
        styles.centerGlow,
        {
          transform: [{ scale: haloPulse }],
          backgroundColor: `rgba(201,116,91,${0.06 + ratio * 0.12})`,
          width: 60 + ratio * 20,
          height: 60 + ratio * 20,
          borderRadius: 30 + ratio * 10,
        },
      ]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: SW - 48,
    height: 320,
  },
  halo: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: 'rgba(201,116,91,0.04)',
  },
  innerRing: {
    position: 'absolute',
    width: SIZE * 0.6,
    height: SIZE * 0.6,
    borderRadius: SIZE * 0.3,
    borderWidth: 1,
    borderColor: 'rgba(201,116,91,0.15)',
  },
  blobLayer: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blob: {
    position: 'absolute',
  },
  centerGlow: {
    position: 'absolute',
  },
});
