import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  TextInput,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

import { usePhotos } from './src/hooks/usePhotos';
import { useColor } from './src/hooks/useColor';
import CardViewWithRef, { type CardViewHandle } from './src/card/CardView';
import type { AnalysisResult, TimePeriod } from './src/types';

// -- Helpers ------------------------------------------------------------------

function makePeriod(year: number, month: number): TimePeriod {
  const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);
  const label = `${year}年${month}月`;
  return { startDate, endDate, label };
}

function formatMonthLabel(year: number, month: number): string {
  return `${year}年${month}月`;
}

// -- App ----------------------------------------------------------------------

export default function App() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const period = useMemo(() => makePeriod(year, month), [year, month]);

  // ---- Photo loading ----
  const {
    permission,
    requestPermission,
    photos,
    loading: photosLoading,
    reload,
  } = usePhotos(period);

  // ---- Color analysis ----
  const {
    analyze,
    loading: analyzing,
    error: analysisError,
    clearError,
    abort,
    progress,
  } = useColor();

  // ---- Result state ----
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const cardRef = useRef<CardViewHandle>(null);

  // ---- User feeling for caption regeneration ----
  const [userFeeling, setUserFeeling] = useState('');
  const [regeneratingCaption, setRegeneratingCaption] = useState(false);

  // ---- Month navigation ----
  const goToPrevMonth = useCallback(() => {
    abort();
    clearError();
    setResult(null);
    setUserFeeling('');
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else { setMonth((m) => m - 1); }
  }, [month, abort, clearError]);

  const goToNextMonth = useCallback(() => {
    abort();
    clearError();
    setResult(null);
    setUserFeeling('');
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else { setMonth((m) => m + 1); }
  }, [month, abort, clearError]);

  const handlePeriodChange = useCallback(async () => {
    if (permission?.granted) await reload();
  }, [permission, reload]);

  React.useEffect(() => { handlePeriodChange(); }, [period, handlePeriodChange]);

  // ---- Analyze handler ----
  const handleAnalyze = useCallback(async () => {
    clearError();
    setResult(null);
    setUserFeeling('');

    if (!permission?.granted) {
      const response = await requestPermission();
      if (!response.granted) return;
      await reload();
    }

    if (photos.length === 0 && !photosLoading) {
      await reload();
    }

    try {
      const analysisResult = await analyze(photos, period.label);
      setResult(analysisResult);
    } catch { /* error set in hook */ }
  }, [permission, requestPermission, reload, photos, photosLoading, analyze, period.label, clearError]);

  // ---- Regenerate caption with user feeling ----
  const handleRegenerateCaption = useCallback(async () => {
    if (!result || !userFeeling.trim()) return;
    setRegeneratingCaption(true);
    try {
      // Re-run analysis with the same photos but include user feeling
      const newResult = await analyze(photos, period.label, userFeeling.trim());
      setResult(newResult);
    } catch { /* error set in hook */ }
    finally { setRegeneratingCaption(false); }
  }, [result, userFeeling, analyze, photos, period.label]);

  // ---- Save ----
  const handleSave = useCallback(async () => {
    if (!cardRef.current) return;
    try {
      const uri = await cardRef.current.capture();
      if (!uri) { Alert.alert('保存失败', '无法生成图片'); return; }
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('保存成功', '已保存到相册');
    } catch (err) {
      Alert.alert('保存失败', '请检查相册权限');
    }
  }, []);

  // ---- Share ----
  const handleShare = useCallback(async () => {
    if (!cardRef.current) return;
    try {
      const uri = await cardRef.current.capture();
      if (!uri) { Alert.alert('分享失败', '无法生成图片'); return; }
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) { Alert.alert('分享失败', '当前设备不支持分享'); return; }
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: '分享你的生活平均色',
      });
    } catch (err) {
      Alert.alert('分享失败', '请稍后重试');
    }
  }, []);

  // ---- Derived UI states ----
  const permissionDenied = permission && !permission.granted;
  const noPhotos = permission?.granted && !photosLoading && photos.length === 0 && !result;
  const isLoading = analyzing || (photosLoading && permission?.granted && !result);
  const hasResult = result !== null;

  // ---- Render ---------------------------------------------------------------
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.title}>生活平均色</Text>
        <Text style={styles.subtitle}>你的相册，调成一杯莫吉托的颜色</Text>

        {/* Month Selector */}
        <View style={styles.monthSelector}>
          <TouchableOpacity onPress={goToPrevMonth} style={styles.arrowButton} disabled={isLoading} activeOpacity={0.6}>
            <Text style={styles.arrowText}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{formatMonthLabel(year, month)}</Text>
          <TouchableOpacity onPress={goToNextMonth} style={styles.arrowButton} disabled={isLoading} activeOpacity={0.6}>
            <Text style={styles.arrowText}>{'>'}</Text>
          </TouchableOpacity>
        </View>

        {/* Analyze Button */}
        <TouchableOpacity
          onPress={handleAnalyze}
          style={[styles.analyzeButton, isLoading && styles.analyzeButtonDisabled]}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#1a1a2e" size="small" />
          ) : (
            <Text style={styles.analyzeButtonText}>{hasResult ? '重新分析' : '开始分析'}</Text>
          )}
        </TouchableOpacity>

        {/* Permission Denied */}
        {permissionDenied && (
          <View style={styles.stateContainer}>
            <Text style={styles.stateIcon}>🔒</Text>
            <Text style={styles.stateText}>需要访问相册权限才能分析色彩</Text>
            <TouchableOpacity onPress={requestPermission} style={styles.secondaryButton} activeOpacity={0.7}>
              <Text style={styles.secondaryButtonText}>去设置开启相册权限</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* No Photos */}
        {noPhotos && (
          <View style={styles.stateContainer}>
            <Text style={styles.stateIcon}>📷</Text>
            <Text style={styles.stateText}>这个时段没有照片</Text>
          </View>
        )}

        {/* Loading photos */}
        {photosLoading && !permissionDenied && !analyzing && !hasResult && (
          <View style={styles.stateContainer}>
            <ActivityIndicator color="rgba(255,255,255,0.6)" size="large" />
            <Text style={styles.stateText}>正在加载照片...</Text>
          </View>
        )}

        {/* Analysis in Progress */}
        {analyzing && (
          <View style={styles.stateContainer}>
            <ActivityIndicator color="#e94560" size="large" />
            <Text style={styles.stateText}>正在分析你的色彩...</Text>
            {progress ? (
              <>
                <Text style={styles.stateHint}>已处理 {progress.current} / {progress.total} 张照片</Text>
                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBarFill, { width: `${Math.round((progress.current / progress.total) * 100)}%` }]} />
                </View>
              </>
            ) : (
              <Text style={styles.stateHint}>正在读取每张照片的调色板</Text>
            )}
            <TouchableOpacity onPress={abort} style={styles.cancelButton} activeOpacity={0.7}>
              <Text style={styles.cancelButtonText}>取消</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Analysis Error */}
        {analysisError && !analyzing && (
          <View style={styles.stateContainer}>
            <Text style={styles.stateIcon}>⚠️</Text>
            <Text style={styles.stateText}>{analysisError}</Text>
            <TouchableOpacity onPress={handleAnalyze} style={styles.secondaryButton} activeOpacity={0.7}>
              <Text style={styles.secondaryButtonText}>重试</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Result Section */}
        {hasResult && result && (
          <View style={styles.resultSection}>
            {/* Gradient Card */}
            <CardViewWithRef
              ref={cardRef}
              gradientColors={result.gradientColors}
              timeLabel={result.timeLabel}
              caption={result.caption}
              namedColors={result.namedColors}
            />

            {/* Photo count */}
            <Text style={styles.photoCount}>基于 {result.photoCount} 张照片分析</Text>

            {/* Recommended photos */}
            {result.recommendedPhotos.length > 0 && (
              <View style={styles.recommendSection}>
                <Text style={styles.recommendTitle}>最接近平均色的照片</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.recommendRow}
                >
                  {result.recommendedPhotos.map((rp, i) => (
                    <Image
                      key={i}
                      source={{ uri: rp.uri }}
                      style={styles.recommendThumb}
                      resizeMode="cover"
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* User feeling input */}
            <View style={styles.feelingSection}>
              <Text style={styles.feelingLabel}>这个月印象最深的事 / 最大的感受（选填）</Text>
              <TextInput
                style={styles.feelingInput}
                value={userFeeling}
                onChangeText={setUserFeeling}
                placeholder="例如：每天都在下雨、终于去了海边..."
                placeholderTextColor="rgba(255,255,255,0.25)"
                multiline
                maxLength={100}
                editable={!regeneratingCaption}
              />
              <TouchableOpacity
                onPress={handleRegenerateCaption}
                style={[styles.feelingButton, (!userFeeling.trim() || regeneratingCaption) && styles.feelingButtonDisabled]}
                disabled={!userFeeling.trim() || regeneratingCaption}
                activeOpacity={0.7}
              >
                {regeneratingCaption ? (
                  <ActivityIndicator color="#1a1a2e" size="small" />
                ) : (
                  <Text style={styles.feelingButtonText}>让 AI 重新配文</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Action buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity onPress={handleSave} style={styles.actionButton} activeOpacity={0.7}>
                <Text style={styles.actionButtonText}>保存</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleShare} style={styles.actionButton} activeOpacity={0.7}>
                <Text style={styles.actionButtonText}>分享</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// -- Styles -------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1a1a2e' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 80, alignItems: 'center' },

  // Header
  title: { fontSize: 32, fontWeight: '800', color: '#ffffff', letterSpacing: 2, marginBottom: 8 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.5)', letterSpacing: 1, marginBottom: 40 },

  // Month selector
  monthSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 28 },
  arrowButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  arrowText: { color: '#ffffff', fontSize: 28, fontWeight: '300', lineHeight: 30 },
  monthLabel: { fontSize: 20, fontWeight: '600', color: '#ffffff', letterSpacing: 1, minWidth: 100, textAlign: 'center' },

  // Analyze button
  analyzeButton: { backgroundColor: '#e94560', paddingHorizontal: 48, paddingVertical: 14, borderRadius: 28, marginBottom: 32, minWidth: 180, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  analyzeButtonDisabled: { opacity: 0.6 },
  analyzeButtonText: { color: '#1a1a2e', fontSize: 16, fontWeight: '700', letterSpacing: 1 },

  // State containers
  stateContainer: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20, gap: 12 },
  stateIcon: { fontSize: 40, marginBottom: 4 },
  stateText: { color: 'rgba(255,255,255,0.7)', fontSize: 16, textAlign: 'center', lineHeight: 24 },
  stateHint: { color: 'rgba(255,255,255,0.35)', fontSize: 13, textAlign: 'center' },

  // Buttons
  secondaryButton: { marginTop: 12, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  secondaryButtonText: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600' },
  cancelButton: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(233, 69, 96, 0.5)' },
  cancelButtonText: { color: '#e94560', fontSize: 14, fontWeight: '600' },

  // Progress
  progressBarContainer: { width: '80%', height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden', marginTop: 4 },
  progressBarFill: { height: '100%', backgroundColor: '#e94560', borderRadius: 2 },

  // Result
  resultSection: { width: '100%', alignItems: 'center', marginTop: 8 },
  photoCount: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 12, letterSpacing: 0.5 },

  // Recommended photos
  recommendSection: { width: '100%', marginTop: 20 },
  recommendTitle: { color: 'rgba(255,255,255,0.5)', fontSize: 12, letterSpacing: 1, marginBottom: 10, textAlign: 'center' },
  recommendRow: { gap: 10, paddingHorizontal: 12, justifyContent: 'center' },
  recommendThumb: { width: 90, height: 90, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },

  // Feeling input
  feelingSection: { width: '100%', marginTop: 22, paddingHorizontal: 8 },
  feelingLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 12, letterSpacing: 0.5, marginBottom: 8 },
  feelingInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
    minHeight: 60,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  feelingButton: {
    backgroundColor: '#e94560',
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingVertical: 10,
    marginTop: 12,
    alignSelf: 'center',
    minWidth: 140,
    alignItems: 'center',
    minHeight: 40,
    justifyContent: 'center',
  },
  feelingButtonDisabled: { opacity: 0.45 },
  feelingButtonText: { color: '#1a1a2e', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },

  // Action
  actionRow: { flexDirection: 'row', gap: 16, marginTop: 24 },
  actionButton: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', minWidth: 100, alignItems: 'center' },
  actionButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '600', letterSpacing: 1 },
});
