import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import CustomDatePicker from './CustomDatePicker';

export type PeriodType = 'today' | 'week' | 'month' | 'year' | 'custom';

export interface PeriodSelectorProps {
  periodType: PeriodType;
  year: number;
  month: number;
  onPeriodTypeChange: (type: PeriodType) => void;
  onPrev: () => void;
  onNext: () => void;
  customStart?: Date | null;
  customEnd?: Date | null;
  onCustomDateChange?: (start: Date | null, end: Date | null) => void;
}

// -- Labels --------------------------------------------------------------------

function displayLabel(type: PeriodType, year: number, month: number): string {
  switch (type) {
    case 'today': return '今天';
    case 'week': return '本周';
    case 'month': return `${year}年${month}月`;
    case 'year': return `${year}年`;
    case 'custom': return '自定义时段';
  }
}

function subLabel(type: PeriodType): string {
  switch (type) {
    case 'today': return '今日照片';
    case 'week': return '周一至周日';
    case 'month': return '整月';
    case 'year': return '全年';
    case 'custom': return '选择起止日期';
  }
}

const PRESETS: { key: PeriodType; label: string }[] = [
  { key: 'today', label: '今天' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'year', label: '今年' },
  { key: 'custom', label: '自定义' },
];

// -- Component -----------------------------------------------------------------

export default function PeriodSelector({
  periodType,
  year,
  month,
  onPeriodTypeChange,
  onPrev,
  onNext,
  customStart,
  customEnd,
  onCustomDateChange,
}: PeriodSelectorProps) {
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const canNav = periodType !== 'today' && periodType !== 'week' && periodType !== 'custom';

  const handleStartDate = (date: Date) => {
    setShowStartPicker(false);
    onCustomDateChange?.(date, customEnd || null);
  };

  const handleEndDate = (date: Date) => {
    setShowEndPicker(false);
    onCustomDateChange?.(customStart || null, date);
  };

  const fmt = (d: Date | null | undefined) => {
    if (!d) return '选择日期';
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <View style={styles.container}>
      {/* ── Main display with navigation ────────────────────────────────── */}
      {canNav ? (
        <View style={styles.navRow}>
          <TouchableOpacity onPress={onPrev} style={styles.navBtn} activeOpacity={0.4}>
            <Text style={styles.navArrow}>‹</Text>
          </TouchableOpacity>
          <View style={styles.navCenter}>
            <Text style={styles.navMain}>{displayLabel(periodType, year, month)}</Text>
            <Text style={styles.navSub}>{subLabel(periodType)}</Text>
          </View>
          <TouchableOpacity onPress={onNext} style={styles.navBtn} activeOpacity={0.4}>
            <Text style={styles.navArrow}>›</Text>
          </TouchableOpacity>
        </View>
      ) : (periodType === 'today' || periodType === 'week') ? (
        <View style={styles.navCenter}>
          <Text style={styles.navMain}>{displayLabel(periodType, year, month)}</Text>
          <Text style={styles.navSub}>{subLabel(periodType)}</Text>
        </View>
      ) : (
        /* Custom range */
        <View style={styles.customRow}>
          <TouchableOpacity
            style={styles.dateBtn}
            onPress={() => setShowStartPicker(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.dateLabel}>从</Text>
            <Text style={[styles.dateText, !customStart && styles.dateMuted]}>
              {fmt(customStart)}
            </Text>
          </TouchableOpacity>
          <Text style={styles.dateSep}>至</Text>
          <TouchableOpacity
            style={styles.dateBtn}
            onPress={() => setShowEndPicker(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.dateLabel}>到</Text>
            <Text style={[styles.dateText, !customEnd && styles.dateMuted]}>
              {fmt(customEnd)}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Preset pills ────────────────────────────────────────────────── */}
      <View style={styles.pills}>
        {PRESETS.map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[styles.pill, periodType === p.key && styles.pillActive]}
            onPress={() => onPeriodTypeChange(p.key)}
            activeOpacity={0.6}
          >
            <Text style={[styles.pillText, periodType === p.key && styles.pillTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Date pickers ────────────────────────────────────────────────── */}
      <CustomDatePicker
        visible={showStartPicker}
        initialDate={customStart || new Date()}
        maximumDate={customEnd || undefined}
        onConfirm={handleStartDate}
        onCancel={() => setShowStartPicker(false)}
      />
      <CustomDatePicker
        visible={showEndPicker}
        initialDate={customEnd || new Date()}
        minimumDate={customStart || undefined}
        onConfirm={handleEndDate}
        onCancel={() => setShowEndPicker(false)}
      />
    </View>
  );
}

// -- Styles --------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { width: '100%', alignItems: 'center', gap: 18 },

  // ── Navigation ────────────────────────────────────────────────────────────
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrow: { color: 'rgba(255,255,255,0.4)', fontSize: 26, fontWeight: '200', lineHeight: 28 },
  navCenter: { alignItems: 'center', flex: 1 },
  navMain: { color: '#ffffff', fontSize: 22, fontWeight: '700', letterSpacing: 2 },
  navSub: { color: 'rgba(255,255,255,0.3)', fontSize: 11, letterSpacing: 1, marginTop: 3 },

  // ── Custom date ────────────────────────────────────────────────────────────
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flex: 1,
  },
  dateLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 12 },
  dateText: { color: '#ffffff', fontSize: 14, fontWeight: '600', flex: 1 },
  dateMuted: { color: 'rgba(255,255,255,0.2)' },
  dateSep: { color: 'rgba(255,255,255,0.2)', fontSize: 14 },

  // ── Presets ────────────────────────────────────────────────────────────────
  pills: {
    flexDirection: 'row',
    gap: 6,
  },
  pill: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  pillActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  pillText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
    fontWeight: '500',
  },
  pillTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
