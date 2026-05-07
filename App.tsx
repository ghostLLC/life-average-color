import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
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
  Modal,
  StatusBar,
  Animated,
  BackHandler,
} from 'react-native';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import RNShare from 'react-native-share';
import LinearGradient from 'react-native-linear-gradient';

import { usePhotos } from './src/hooks/usePhotos';
import { useColor } from './src/hooks/useColor';
import { useOCRFilter } from './src/hooks/useOCRFilter';
import { generateCaption } from './src/caption/generate';
import CardViewWithRef, { type CardViewHandle } from './src/card/CardView';
import PhotoPicker from './src/components/PhotoPicker';
import PosterWithRef, { type PosterHandle } from './src/components/Poster';
import PeriodSelector, { type PeriodType } from './src/components/PeriodSelector';
import AnalysisAnimation from './src/components/AnalysisAnimation';
import type { AnalysisResult, TimePeriod, PhotoAsset } from './src/types';

// -- Helpers ------------------------------------------------------------------

const now = new Date();
const THIS_YEAR = now.getFullYear();
const THIS_MONTH = now.getMonth() + 1;

function makePeriod(
  type: PeriodType,
  year: number,
  month: number,
  customStart?: Date | null,
  customEnd?: Date | null,
): TimePeriod {
  if (type === 'custom' && customStart && customEnd) {
    const s = new Date(customStart); s.setHours(0, 0, 0, 0);
    const e = new Date(customEnd); e.setHours(23, 59, 59, 999);
    return { startDate: s, endDate: e, label: `${s.getFullYear()}/${s.getMonth() + 1}/${s.getDate()} → ${e.getFullYear()}/${e.getMonth() + 1}/${e.getDate()}` };
  }
  if (type === 'today') {
    const s = new Date(); s.setHours(0, 0, 0, 0);
    const e = new Date(); e.setHours(23, 59, 59, 999);
    return { startDate: s, endDate: e, label: '今天' };
  }
  if (type === 'week') {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - ((today.getDay() + 6) % 7)); // Monday
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    return { startDate: startOfWeek, endDate: endOfWeek, label: `${year}年${month}月 本周` };
  }
  if (type === 'year') {
    return {
      startDate: new Date(year, 0, 1, 0, 0, 0, 0),
      endDate: new Date(year, 11, 31, 23, 59, 59, 999),
      label: `${year}年`,
    };
  }
  // default: month
  const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);
  return { startDate, endDate, label: `${year}年${month}月` };
}

// -- App ----------------------------------------------------------------------

export default function App() {
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [year, setYear] = useState(THIS_YEAR);
  const [month, setMonth] = useState(THIS_MONTH);
  const [customStart, setCustomStart] = useState<Date | null>(null);
  const [customEnd, setCustomEnd] = useState<Date | null>(null);
  const period = useMemo(
    () => makePeriod(periodType, year, month, customStart, customEnd),
    [periodType, year, month, customStart, customEnd],
  );

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

  // ---- Result state + caching ----
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const resultCache = useRef<Map<string, AnalysisResult>>(new Map());
  const cardRef = useRef<CardViewHandle>(null);
  const posterShareRef = useRef<PosterHandle>(null);
  const posterSaveRef = useRef<PosterHandle>(null);
  const [showPoster, setShowPoster] = useState(false);

  // ---- Entrance animation ----
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (result) {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [result, fadeAnim]);

  // ---- OCR filtering ----
  const {
    filter: ocrFilter,
    loading: ocrLoading,
    progress: ocrProgress,
  } = useOCRFilter();

  // ---- Photo picker state ----
  const [showPicker, setShowPicker] = useState(false);
  const [flaggedUris, setFlaggedUris] = useState<Set<string>>(new Set());
  const [scannedUris, setScannedUris] = useState<Set<string>>(new Set());
  const [pickerPhotos, setPickerPhotos] = useState<PhotoAsset[]>([]);

  // ---- User feeling for caption regeneration ----
  const [userFeeling, setUserFeeling] = useState('');
  const [regeneratingCaption, setRegeneratingCaption] = useState(false);

  // ---- Period navigation (result-aware) ----
  const clearForNav = useCallback(() => {
    abort();
    clearError();
    setShowPicker(false);
    setFlaggedUris(new Set());
  }, [abort, clearError]);

  const handlePrev = useCallback(() => {
    clearForNav();
    setUserFeeling('');
    if (periodType === 'today' || periodType === 'week' || periodType === 'custom') return;
    if (periodType === 'month') {
      const [ny, nm] = month === 1 ? [year - 1, 12] : [year, month - 1];
      setYear(ny); setMonth(nm);
    } else if (periodType === 'year') {
      setYear((y) => y - 1);
    }
  }, [periodType, year, month, clearForNav]);

  const handleNext = useCallback(() => {
    clearForNav();
    setUserFeeling('');
    if (periodType === 'today' || periodType === 'week' || periodType === 'custom') return;
    if (periodType === 'month') {
      const [ny, nm] = month === 12 ? [year + 1, 1] : [year, month + 1];
      setYear(ny); setMonth(nm);
    } else if (periodType === 'year') {
      setYear((y) => y + 1);
    }
  }, [periodType, year, month, clearForNav]);

  const handlePeriodChange = useCallback(async () => {
    if (permission) await reload();
  }, [permission, reload]);

  React.useEffect(() => { handlePeriodChange(); }, [period, handlePeriodChange]);

  // ---- Navigation: home ↔ result ----
  const goHome = useCallback(() => {
    setResult(null);
    setUserFeeling('');
  }, []);

  // Jump to a cached result from history carousel
  const openHistoryResult = useCallback((label: string) => {
    const cached = resultCache.current.get(label);
    if (cached) setResult(cached);
  }, []);

  // Check if current period already has a cached result
  const periodHasResult = resultCache.current.has(period.label);

  // ---- Analyze handler → opens photo picker first ----
  const handleAnalyze = useCallback(async () => {
    if (periodHasResult) {
      Alert.alert('已存在分析结果', '该时段已经生成过色彩报告，可在下方「往期回顾」中点击查看，或在首页切换时段后重新分析。');
      return;
    }
    clearError();
    setResult(null);
    setUserFeeling('');

    if (!permission) {
      const granted = await requestPermission();
      if (!granted) return;
      await reload();
    }

    if (photos.length === 0 && !photosLoading) {
      await reload();
    }

    if (photos.length === 0) {
      Alert.alert('提示', '这个时段没有照片');
      return;
    }

    // Open picker and auto-start OCR
    setPickerPhotos([...photos]);
    setFlaggedUris(new Set());
    setScannedUris(new Set());
    setShowPicker(true);

    // Fire OCR with per-photo callback for real-time border updates
    ocrFilter(photos.map((p) => p.uri), (uri, flagged) => {
      setScannedUris((prev) => new Set(prev).add(uri));
      if (flagged) setFlaggedUris((prev) => new Set(prev).add(uri));
    });
  }, [permission, requestPermission, reload, photos, photosLoading, clearError, ocrFilter, periodHasResult]);

  // ---- Picker confirmation → runs analysis on selected photos ----
  const handlePickerConfirm = useCallback(async (selectedPhotos: PhotoAsset[]) => {
    setShowPicker(false);
    try {
      const analysisResult = await analyze(selectedPhotos, period.label);
      setResult(analysisResult);
      resultCache.current.set(period.label, analysisResult);
    } catch { /* error set in hook */ }
  }, [analyze, period.label]);

  // ---- Regenerate caption with user feeling ----
  const handleRegenerateCaption = useCallback(async () => {
    if (!result || !userFeeling.trim()) return;
    setRegeneratingCaption(true);
    try {
      const colorDescriptors = result.namedColors.map((nc) => nc.hex);
      const newCaption = await generateCaption(colorDescriptors, result.timeLabel, userFeeling.trim());
      if (newCaption) {
        setResult({ ...result, caption: newCaption });
      }
    } catch { /* ignore */ }
    finally { setRegeneratingCaption(false); }
  }, [result, userFeeling]);

  // ---- Save → poster preview ----
  const handleSave = useCallback(async () => {
    setShowPoster(true);
  }, []);

  const handlePosterSave = useCallback(async () => {
    if (!posterSaveRef.current) return;
    try {
      const uri = await posterSaveRef.current.capture();
      if (!uri) { Alert.alert('保存失败', '无法生成图片'); return; }
      await CameraRoll.save(uri, { type: 'photo' });
      setShowPoster(false);
      goHome();
      Alert.alert('保存成功', '已保存到相册');
    } catch (err) {
      Alert.alert('保存失败', '请检查相册权限');
    }
  }, []);

  // ---- Share poster ----
  const handleShare = useCallback(async () => {
    if (!posterShareRef.current) return;
    try {
      const uri = await posterShareRef.current.capture();
      if (!uri) { Alert.alert('分享失败', '无法生成图片'); return; }
      const shareUrl = uri.startsWith('file://') ? uri : `file://${uri}`;
      await RNShare.open({
        url: shareUrl,
        type: 'image/png',
        title: '分享我的生活平均色',
        filename: 'life-average-color',
      });
    } catch (err) {
      if ((err as any)?.message !== 'User did not share') {
        Alert.alert('分享失败', '请稍后重试');
        return;
      }
    }
    goHome();
  }, [goHome]);

  // ---- Derived UI states ----
  const permissionDenied = permission !== null && !permission;
  const noPhotos = !!permission && !photosLoading && photos.length === 0 && !result;
  const isLoading = analyzing || (photosLoading && !!permission && !result);
  const hasResult = result !== null;

  // ---- Android back gesture ───────────────────────────────────────────────
  useEffect(() => {
    const handler = () => {
      if (showPoster) { setShowPoster(false); return true; }
      if (showPicker) { setShowPicker(false); return true; }
      if (result) { goHome(); return true; }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', handler);
    return () => sub.remove();
  }, [showPoster, showPicker, result, goHome]);

  // ---- Render ---------------------------------------------------------------
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />

      {/* Photo Picker — full-screen modal with auto OCR */}
      <PhotoPicker
        visible={showPicker}
        photos={pickerPhotos}
        flaggedUris={flaggedUris}
        scannedUris={scannedUris}
        ocrLoading={ocrLoading}
        ocrProgress={ocrProgress}
        onConfirm={handlePickerConfirm}
        onCancel={() => { setShowPicker(false); }}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, hasResult && { ...styles.scrollContentResult, paddingTop: 12 + (StatusBar.currentHeight || 32) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header — shown only before analysis */}
        {!hasResult && (
          <>
            <Text style={styles.title}>生活平均色</Text>
            <Text style={styles.subtitle}>你的相册，调成一杯莫吉托的颜色</Text>

            {/* Period Selector */}
            <PeriodSelector
              periodType={periodType}
              year={year}
              month={month}
              onPeriodTypeChange={(t) => { setPeriodType(t); setResult(null); }}
              onPrev={handlePrev}
              onNext={handleNext}
              customStart={customStart}
              customEnd={customEnd}
              onCustomDateChange={(s, e) => { setCustomStart(s); setCustomEnd(e); }}
            />

            {/* Analyze Button */}
            <TouchableOpacity
              onPress={handleAnalyze}
              style={[
                styles.analyzeButton,
                (isLoading || periodHasResult) && styles.analyzeButtonDisabled,
                periodHasResult && styles.analyzeButtonDone,
              ]}
              disabled={isLoading || periodHasResult}
              activeOpacity={periodHasResult ? 1 : 0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={[styles.analyzeButtonText, periodHasResult && styles.analyzeButtonTextDone]}>
                  {periodHasResult ? '已生成报告' : '开始分析'}
                </Text>
              )}
            </TouchableOpacity>

            {/* History Carousel — mini poster previews */}
            {resultCache.current.size > 0 && (
              <View style={styles.historySection}>
                <Text style={styles.historyTitle}>往期回顾</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.historyRow}
                >
                  {Array.from(resultCache.current.entries()).map(([label, r]) => {
                    const safeColors: (string | number)[] = r.gradientColors.length >= 2
                      ? r.gradientColors
                      : ['#1a1a2e', '#16213e'];
                    return (
                      <TouchableOpacity
                        key={label}
                        style={styles.historyCard}
                        onPress={() => openHistoryResult(label)}
                        activeOpacity={0.7}
                      >
                        <LinearGradient
                          colors={safeColors as string[]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.historyCardInner}
                        >
                          <Text style={styles.historyMiniLabel}>{label}</Text>
                          <View style={{ flex: 1 }} />
                          <Text style={styles.historyMiniCaption} numberOfLines={2}>
                            {r.caption}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Placeholder when no history yet */}
            {resultCache.current.size === 0 && (
              <View style={styles.historyPlaceholder}>
                <Text style={styles.historyPlaceholderText}>
                  分析过的月份会出现在这里，{'\n'}点击即可回顾
                </Text>
              </View>
            )}
          </>
        )}

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
            <AnalysisAnimation
              progress={progress || { current: 0, total: photos.length }}
              phase="running"
            />
            <TouchableOpacity onPress={abort} style={styles.cancelButton} activeOpacity={0.7}>
              <Text style={styles.cancelButtonText}>取消分析</Text>
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

        {/* Result Section — with entrance animation */}
        {hasResult && result && (
          <Animated.View style={[styles.resultSection, { opacity: fadeAnim }]}>
            {/* Gradient Card */}
            <CardViewWithRef
              ref={cardRef}
              gradientColors={result.gradientColors}
              timeLabel={result.timeLabel}
              caption={result.caption}
              namedColors={result.namedColors}
            />

            {/* Recommended photos */}
            {result.recommendedPhotos.length > 0 && (
              <View style={styles.recommendSection}>
                <Text style={styles.recommendTitle}>最接近平均色的瞬间</Text>
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

            {/* Divider */}
            <View style={styles.divider} />

            {/* Feeling + re-caption inline */}
            <View style={styles.feelingSection}>
              <Text style={styles.feelingLabel}>这个月的感受（选填）</Text>
              <View style={styles.feelingRow}>
                <TextInput
                  style={styles.feelingInput}
                  value={userFeeling}
                  onChangeText={setUserFeeling}
                  placeholder="下雨、海边、咖啡馆……"
                  placeholderTextColor="rgba(255,255,255,0.12)"
                  maxLength={100}
                  editable={!regeneratingCaption}
                />
                <TouchableOpacity
                  onPress={handleRegenerateCaption}
                  style={[styles.feelingBtn, (!userFeeling.trim() || regeneratingCaption) && styles.feelingBtnDisabled]}
                  disabled={!userFeeling.trim() || regeneratingCaption}
                  activeOpacity={0.7}
                >
                  {regeneratingCaption ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.feelingBtnText}>重新配文</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Actions — share primary, save secondary */}
            <View style={styles.actionRow}>
              <TouchableOpacity onPress={handleShare} style={styles.btnPrimary} activeOpacity={0.8}>
                <Text style={styles.btnPrimaryText}>分享海报</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} style={styles.btnSecondary} activeOpacity={0.7}>
                <Text style={styles.btnSecondaryText}>保存海报</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* Hidden poster instance for share capture */}
      {hasResult && result && (
        <View style={{ position: 'absolute', left: -9999, top: 0 }}>
          <PosterWithRef
            ref={posterShareRef}
            gradientColors={result.gradientColors}
            namedColors={result.namedColors}
            timeLabel={result.timeLabel}
            caption={result.caption}
            recommendedPhotos={result.recommendedPhotos}
          />
        </View>
      )}

      {/* Poster preview modal */}
      {hasResult && result && (
        <Modal visible={showPoster} animationType="fade" transparent onRequestClose={() => setShowPoster(false)}>
          <View style={styles.posterModalBg}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowPoster(false)} activeOpacity={1} />
            <PosterWithRef
              ref={posterSaveRef}
              gradientColors={result.gradientColors}
              namedColors={result.namedColors}
              timeLabel={result.timeLabel}
              caption={result.caption}
              recommendedPhotos={result.recommendedPhotos}
            />
            <View style={styles.posterActions}>
              <TouchableOpacity onPress={() => setShowPoster(false)} style={styles.posterCancelBtn} activeOpacity={0.7}>
                <Text style={styles.posterCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handlePosterSave} style={styles.posterSaveBtn} activeOpacity={0.8}>
                <Text style={styles.posterSaveText}>保存到相册</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

// -- Styles -------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1a1a2e' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 100, alignItems: 'center' },
  scrollContentResult: { paddingTop: 12 + (StatusBar.currentHeight || 32) },

  title: { fontSize: 32, fontWeight: '800', color: '#ffffff', letterSpacing: 3, marginBottom: 6 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.35)', letterSpacing: 1, marginBottom: 44 },

  // ── Buttons ────────────────────────────────────────────────────────────────
  btnPrimary: {
    backgroundColor: '#e94560',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 16,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: { color: '#ffffff', fontSize: 15, fontWeight: '700', letterSpacing: 1 },
  btnSecondary: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: { color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: '600' },

  // ── Analyze CTA ────────────────────────────────────────────────────────────
  analyzeButton: {
    backgroundColor: '#e94560',
    paddingHorizontal: 56,
    paddingVertical: 16,
    borderRadius: 18,
    marginTop: 8,
    minWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  analyzeButtonDisabled: { opacity: 0.5 },
  analyzeButtonDone: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  analyzeButtonText: { color: '#ffffff', fontSize: 17, fontWeight: '700', letterSpacing: 2 },
  analyzeButtonTextDone: { color: 'rgba(255,255,255,0.3)' },

  // ── States ─────────────────────────────────────────────────────────────────
  stateContainer: { alignItems: 'center', paddingVertical: 50, paddingHorizontal: 24, gap: 16 },
  stateIcon: { fontSize: 44, marginBottom: 4 },
  stateText: { color: 'rgba(255,255,255,0.55)', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  stateHint: { color: 'rgba(255,255,255,0.25)', fontSize: 13, textAlign: 'center' },

  secondaryButton: { marginTop: 16, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  secondaryButtonText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '600' },
  cancelButton: { marginTop: 20, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(233, 69, 96, 0.4)' },
  cancelButtonText: { color: '#e94560', fontSize: 14, fontWeight: '600' },

  // ── Progress ───────────────────────────────────────────────────────────────
  progressBarContainer: { width: '75%', height: 3, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginTop: 4 },
  progressBarFill: { height: '100%', backgroundColor: '#e94560', borderRadius: 2 },

  // ── Back button ────────────────────────────────────────────────────────────
  backBtn: { alignSelf: 'flex-start', marginBottom: 20, paddingVertical: 6, paddingHorizontal: 4 },
  backBtnText: { color: 'rgba(255,255,255,0.35)', fontSize: 14, letterSpacing: 1 },

  // ── Result ─────────────────────────────────────────────────────────────────
  resultSection: { width: '100%', alignItems: 'center' },

  photoCount: { color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 16, letterSpacing: 1 },

  recommendSection: { width: '100%', marginTop: 20 },
  recommendTitle: { color: 'rgba(255,255,255,0.4)', fontSize: 12, letterSpacing: 2, marginBottom: 10, textAlign: 'center' },
  recommendRow: { gap: 10, paddingHorizontal: 16, justifyContent: 'center' },
  recommendThumb: { width: 88, height: 88, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },

  divider: {
    width: 32,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 1,
    marginTop: 22,
    marginBottom: 22,
  },

  // ── Feeling ────────────────────────────────────────────────────────────────
  feelingSection: { width: '100%', paddingHorizontal: 4 },
  feelingLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 12, letterSpacing: 1, marginBottom: 8 },
  feelingRow: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  feelingInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  feelingBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feelingBtnDisabled: { opacity: 0.35 },
  feelingBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '600', letterSpacing: 1 },

  // ── Actions ────────────────────────────────────────────────────────────────
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 20, width: '100%', paddingHorizontal: 4 },

  // ── Poster modal ───────────────────────────────────────────────────────────
  posterModalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 24,
  },
  posterActions: { flexDirection: 'row', gap: 14 },
  posterCancelBtn: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  posterCancelText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '600' },
  posterSaveBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#e94560',
  },
  posterSaveText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },

  // ── History carousel ───────────────────────────────────────────────────────
  historySection: { width: '100%', marginTop: 48 },
  historyTitle: { color: 'rgba(255,255,255,0.35)', fontSize: 12, letterSpacing: 2, marginBottom: 14, textAlign: 'center' },
  historyRow: { gap: 16, paddingHorizontal: 8 },
  historyCard: {
    width: 220,
    height: 310,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  historyCardInner: {
    flex: 1,
    paddingTop: 18,
    paddingBottom: 14,
    paddingHorizontal: 14,
  },
  historyMiniLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 2,
    textAlign: 'center',
  },
  historyMiniCaption: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },

  historyPlaceholder: {
    width: '100%',
    marginTop: 48,
    paddingVertical: 32,
    alignItems: 'center',
  },
  historyPlaceholderText: {
    color: 'rgba(255,255,255,0.15)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 22,
  },
});
