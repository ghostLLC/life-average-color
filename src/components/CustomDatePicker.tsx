import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  Platform,
  StatusBar,
} from 'react-native';

interface CustomDatePickerProps {
  visible: boolean;
  initialDate: Date;
  minimumDate?: Date;
  maximumDate?: Date;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
}

const MONTHS = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月',
];

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function daysInMonth(year: number, month: number): number {
  if (month === 1) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
  }
  return DAYS_IN_MONTH[month];
}

const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 5;

export default function CustomDatePicker({
  visible,
  initialDate,
  minimumDate,
  maximumDate,
  onConfirm,
  onCancel,
}: CustomDatePickerProps) {
  const [year, setYear] = useState(initialDate.getFullYear());
  const [month, setMonth] = useState(initialDate.getMonth());
  const [day, setDay] = useState(initialDate.getDate());

  useEffect(() => {
    if (visible) {
      setYear(initialDate.getFullYear());
      setMonth(initialDate.getMonth());
      setDay(initialDate.getDate());
    }
  }, [visible, initialDate]);

  const maxDay = daysInMonth(year, month);
  const minYear = minimumDate ? minimumDate.getFullYear() : 2000;
  const maxYear = maximumDate ? maximumDate.getFullYear() : 2100;

  // Clamp day when month/year changes
  useEffect(() => {
    if (day > maxDay) setDay(maxDay);
  }, [day, maxDay]);

  const handleConfirm = () => {
    onConfirm(new Date(year, month, Math.min(day, maxDay)));
  };

  const isStartOverlap = minimumDate && year === minimumDate.getFullYear() && month === minimumDate.getMonth();
  const isEndOverlap = maximumDate && year === maximumDate.getFullYear() && month === maximumDate.getMonth();
  const dayMin = isStartOverlap ? (minimumDate?.getDate() ?? 1) : 1;
  const dayMax = isEndOverlap ? (maximumDate?.getDate() ?? maxDay) : maxDay;

  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);
  const months = Array.from({ length: 12 }, (_, i) => i);
  const days = Array.from({ length: dayMax - dayMin + 1 }, (_, i) => dayMin + i);

  // FlatList refs for initial scroll
  const yearRef = useRef<FlatList<any>>(null);
  const monthRef = useRef<FlatList<any>>(null);
  const dayRef = useRef<FlatList<any>>(null);

  const PAD = ITEM_HEIGHT * (VISIBLE_ITEMS - 1) / 2;

  // Scroll to initial values on open
  useEffect(() => {
    if (!visible) return;
    // Use a short delay so the FlatList has laid out
    const t = setTimeout(() => {
      yearRef.current?.scrollToOffset({ offset: years.indexOf(year) * ITEM_HEIGHT, animated: false });
      monthRef.current?.scrollToOffset({ offset: month * ITEM_HEIGHT, animated: false });
      const dIdx = days.indexOf(Math.min(day, dayMax));
      dayRef.current?.scrollToOffset({ offset: Math.max(0, dIdx) * ITEM_HEIGHT, animated: false });
    }, 50);
    return () => clearTimeout(t);
  }, [visible]);

  const renderWheel = (
    data: (string | number)[],
    selected: number,
    onSelect: (v: number) => void,
    label: string,
    ref: React.RefObject<FlatList<any> | null>,
  ) => (
    <View style={styles.wheelCol}>
      <Text style={styles.wheelLabel}>{label}</Text>
      <View style={styles.wheelContainer}>
        <View style={styles.wheelHighlight} pointerEvents="none" />
        <FlatList
          ref={ref as any}
          data={data}
          keyExtractor={(item) => String(item)}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          bounces={false}
          contentContainerStyle={{ paddingVertical: PAD }}
          getItemLayout={(_, index) => ({
            length: ITEM_HEIGHT,
            offset: ITEM_HEIGHT * index,
            index,
          })}
          onMomentumScrollEnd={(e) => {
            const rawIdx = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
            const idx = Math.max(0, Math.min(data.length - 1, rawIdx));
            const value = typeof data[idx] === 'string' ? parseInt(data[idx] as string, 10) : (data[idx] as number);
            const clamped = label === '日' ? Math.max(dayMin, Math.min(dayMax, value)) : value;
            if (clamped !== undefined) onSelect(label === '月' ? clamped - 1 : clamped);
          }}
          renderItem={({ item, index }) => {
            const val = typeof item === 'number'
              ? (label === '月' ? MONTHS[item] : String(item))
              : item;
            const isSelected = label === '月'
              ? (item as number) === selected
              : (label === '日'
                ? parseInt(String(val), 10) === selected
                : Number(val) === selected);
            return (
              <View style={styles.wheelItem}>
                <Text style={[styles.wheelItemText, isSelected && styles.wheelItemSelected]}>
                  {val}
                </Text>
              </View>
            );
          }}
        />
        <View style={styles.wheelFadeTop} pointerEvents="none" />
        <View style={styles.wheelFadeBottom} pointerEvents="none" />
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.panel}>
          <Text style={styles.title}>选择日期</Text>

          <View style={styles.wheelRow}>
            {renderWheel(years, year, setYear, '年', yearRef)}
            {renderWheel(months, month, setMonth, '月', monthRef)}
            {renderWheel(days, day, setDay, '日', dayRef)}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity onPress={onCancel} style={styles.cancelBtn} activeOpacity={0.7}>
              <Text style={styles.cancelText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleConfirm} style={styles.confirmBtn} activeOpacity={0.8}>
              <Text style={styles.confirmText}>确定</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: Platform.OS === 'android' ? 24 + (StatusBar.currentHeight || 32) : 24,
  },

  title: {
    color: '#1C1C1E',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 20,
  },

  // Wheel
  wheelRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 0,
    marginBottom: 24,
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
  },
  wheelCol: {
    flex: 1,
    alignItems: 'center',
  },
  wheelLabel: {
    color: 'rgba(28,28,30,0.2)',
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 8,
  },
  wheelContainer: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
    borderRadius: 14,
  },
  wheelHighlight: {
    position: 'absolute',
    top: ITEM_HEIGHT * (VISIBLE_ITEMS - 1) / 2,
    left: 8,
    right: 8,
    height: ITEM_HEIGHT,
    backgroundColor: 'rgba(201, 116, 91, 0.08)',
    borderRadius: 12,
    zIndex: 0,
  },
  wheelItem: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelItemText: {
    color: 'rgba(28,28,30,0.2)',
    fontSize: 18,
    fontWeight: '500',
  },
  wheelItemSelected: {
    color: '#1C1C1E',
    fontSize: 22,
    fontWeight: '800',
  },
  wheelFadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * 2,
    zIndex: 1,
  },
  wheelFadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * 2,
    zIndex: 1,
  },

  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  cancelText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#C9745B',
    alignItems: 'center',
  },
  confirmText: {
    color: '#1C1C1E',
    fontSize: 15,
    fontWeight: '700',
  },
});
