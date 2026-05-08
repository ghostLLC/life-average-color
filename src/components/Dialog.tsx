import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';

interface DialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmDanger?: boolean;
}

export default function Dialog({
  visible,
  title,
  message,
  confirmText = '确定',
  cancelText,
  onConfirm,
  onCancel,
  confirmDanger,
}: DialogProps) {
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 8, tension: 100, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]).start();
    } else {
      scale.setValue(0.9);
      opacity.setValue(0);
    }
  }, [visible, scale, opacity]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel || onConfirm}>
      <Animated.View style={[styles.overlay, { opacity }]}>
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            {cancelText && (
              <TouchableOpacity onPress={onCancel} style={styles.cancelBtn} activeOpacity={0.7}>
                <Text style={styles.cancelText}>{cancelText}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={onConfirm}
              style={[styles.confirmBtn, confirmDanger && styles.confirmDanger]}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  title: {
    color: '#1C1C1E',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    color: 'rgba(28,28,30,0.45)',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center',
  },
  cancelText: {
    color: 'rgba(28,28,30,0.45)',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#e94560',
    alignItems: 'center',
  },
  confirmDanger: {
    backgroundColor: '#e94560',
  },
  confirmText: {
    color: '#1C1C1E',
    fontSize: 14,
    fontWeight: '700',
  },
});
