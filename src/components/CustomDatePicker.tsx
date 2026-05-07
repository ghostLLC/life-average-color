import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
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

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

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

  // Reset when modal opens
  React.useEffect(() => {
    if (visible) {
      setYear(initialDate.getFullYear());
      setMonth(initialDate.getMonth());
      setDay(initialDate.getDate());
    }
  }, [visible, initialDate]);

  const maxDay = daysInMonth(year, month);

  const minYear = minimumDate ? minimumDate.getFullYear() : 2000;
  const maxYear = maximumDate ? maximumDate.getFullYear() : 2100;

  const adjust = (
    setter: (v: number) => void,
    dir: 1 | -1,
    current: number,
    min: number,
    max: number,
  ) => {
    setter(clamp(current + dir, min, max));
  };

  // Clamp day when month/year changes
  React.useEffect(() => {
    if (day > maxDay) setDay(maxDay);
  }, [day, maxDay]);

  const handleConfirm = () => {
    onConfirm(new Date(year, month, clamp(day, 1, maxDay)));
  };

  const renderStepper = (
    label: string,
    value: string,
    onPrev: () => void,
    onNext: () => void,
  ) => (
    <View style={styles.stepperCol}>
      <TouchableOpacity onPress={onPrev} style={styles.stepperBtn} activeOpacity={0.4}>
        <Text style={styles.stepperArrow}>▲</Text>
      </TouchableOpacity>
      <View style={styles.stepperValue}>
        <Text style={styles.stepperValueText}>{value}</Text>
        <Text style={styles.stepperLabel}>{label}</Text>
      </View>
      <TouchableOpacity onPress={onNext} style={styles.stepperBtn} activeOpacity={0.4}>
        <Text style={styles.stepperArrow}>▼</Text>
      </TouchableOpacity>
    </View>
  );

  const isStartOverlap = minimumDate && year === minimumDate.getFullYear() && month === minimumDate.getMonth();
  const isEndOverlap = maximumDate && year === maximumDate.getFullYear() && month === maximumDate.getMonth();

  const dayMin = isStartOverlap ? (minimumDate?.getDate() ?? 1) : 1;
  const dayMax = isEndOverlap ? (maximumDate?.getDate() ?? maxDay) : maxDay;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.panel}>
          {/* Title */}
          <Text style={styles.title}>选择日期</Text>

          {/* Steppers */}
          <View style={styles.stepperRow}>
            {renderStepper('年', `${year}`, () => adjust(setYear, -1, year, minYear, maxYear), () => adjust(setYear, 1, year, minYear, maxYear))}
            {renderStepper('月', MONTHS[month], () => adjust(setMonth, -1, month, 0, 11), () => adjust(setMonth, 1, month, 0, 11))}
            {renderStepper('日', `${day}`, () => adjust(setDay, -1, day, dayMin, dayMax), () => adjust(setDay, 1, day, dayMin, dayMax))}
          </View>

          {/* Actions */}
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
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: Platform.OS === 'android' ? 24 + (StatusBar.currentHeight || 32) : 24,
  },

  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 28,
  },

  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 32,
  },
  stepperCol: {
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  stepperBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperArrow: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
  },
  stepperValue: {
    alignItems: 'center',
  },
  stepperValueText: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
  },
  stepperLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    marginTop: 4,
    letterSpacing: 1,
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
    backgroundColor: '#e94560',
    alignItems: 'center',
  },
  confirmText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
