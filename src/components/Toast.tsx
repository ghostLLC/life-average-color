import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, Easing } from 'react-native';

interface ToastProps {
  message: string;
  visible: boolean;
  duration?: number;
  onDone: () => void;
}

export default function Toast({ message, visible, duration = 2000, onDone }: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.delay(duration),
      Animated.timing(opacity, { toValue: 0, duration: 400, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]).start(() => onDone());
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.toast, { opacity }]} pointerEvents="none">
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: '45%',
    left: 48,
    right: 48,
    backgroundColor: 'rgba(28,28,30,0.75)',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: 'center',
    zIndex: 9999,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
