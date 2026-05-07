import React, { useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  StatusBar,
  Platform,
} from 'react-native';

import type { PhotoAsset } from '../types';

export interface PhotoPickerProps {
  visible: boolean;
  photos: PhotoAsset[];
  flaggedUris?: Set<string>;
  /** URIs that have already been processed by OCR */
  scannedUris?: Set<string>;
  ocrLoading?: boolean;
  ocrProgress?: { current: number; total: number } | null;
  onConfirm: (selectedPhotos: PhotoAsset[]) => void;
  onCancel: () => void;
}

function PhotoPicker({
  visible,
  photos,
  flaggedUris,
  scannedUris,
  ocrLoading,
  ocrProgress,
  onConfirm,
  onCancel,
}: PhotoPickerProps) {
  const [selectedSet, setSelectedSet] = useState<Set<string>>(
    () => new Set(photos.map((p) => p.uri)),
  );
  const [showBanner, setShowBanner] = useState(true);

  // Reset banner when picker opens, but keep it visible until manually dismissed
  React.useEffect(() => {
    if (visible) setShowBanner(true);
  }, [visible]);

  // Re-seed selection on open, and unselect newly-flagged photos in real-time
  React.useEffect(() => {
    if (!visible) return;
    const flagged = flaggedUris || new Set();
    // On first open, select all non-flagged. After that, only unselect newly flagged.
    setSelectedSet((prev) => {
      if (prev.size === 0 && flagged.size === 0) {
        return new Set(photos.map((p) => p.uri));
      }
      // Remove newly flagged photos from selection
      const next = new Set(prev);
      for (const uri of flagged) {
        next.delete(uri);
      }
      // Add back scanned non-flagged ones that were unselected
      for (const p of photos) {
        if (scannedUris?.has(p.uri) && !flagged.has(p.uri) && !next.has(p.uri)) {
          next.add(p.uri);
        }
      }
      return next;
    });
  }, [visible, photos, flaggedUris, scannedUris]);

  const toggle = useCallback((uri: string) => {
    setSelectedSet((prev) => {
      const next = new Set(prev);
      if (next.has(uri)) next.delete(uri);
      else next.add(uri);
      return next;
    });
  }, []);

  const selectedCount = selectedSet.size;
  const flaggedCount = flaggedUris ? flaggedUris.size : 0;

  const selectAll = useCallback(() => {
    setSelectedSet(new Set(photos.map((p) => p.uri)));
  }, [photos]);

  const handleConfirm = useCallback(() => {
    // If OCR is still scanning, ask for confirmation
    if (ocrLoading) {
      Alert.alert(
        '筛选还在进行中',
        'OCR 智能识别速度很快，建议等全部扫描完成后再开始分析，效果会更好。\n\n确定现在就开始分析吗？',
        [
          { text: '再等等', style: 'cancel' },
          { text: '立即分析', onPress: () => {
            const selected = photos.filter((p) => selectedSet.has(p.uri));
            if (selected.length === 0) {
              Alert.alert('提示', '请至少选择一张照片');
              return;
            }
            onConfirm(selected);
          }},
        ],
        { cancelable: true },
      );
      return;
    }

    const selected = photos.filter((p) => selectedSet.has(p.uri));
    if (selected.length === 0) {
      Alert.alert('提示', '请至少选择一张照片');
      return;
    }
    onConfirm(selected);
  }, [photos, selectedSet, onConfirm, ocrLoading]);

  const renderItem = useCallback(
    ({ item }: { item: PhotoAsset }) => {
      const isSelected = selectedSet.has(item.uri);
      const isFlagged = flaggedUris?.has(item.uri) || false;
      const isScanned = scannedUris?.has(item.uri) || false;

      let ringColor = 'transparent';
      if (isScanned) {
        ringColor = isFlagged ? 'rgba(233, 69, 96, 0.75)' : 'rgba(39, 174, 96, 0.6)';
      }

      return (
        <TouchableOpacity
          style={styles.photoItem}
          onPress={() => toggle(item.uri)}
          activeOpacity={0.7}
        >
          <View style={[styles.photoInner, { borderColor: ringColor }]}>
            <Image source={{ uri: item.uri }} style={styles.thumbnail} resizeMode="cover" />
          </View>
          {/* Selection checkbox */}
          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
            {isSelected && <Text style={styles.checkmark}>✓</Text>}
          </View>
          {/* Scanning state — subtle pulsing badge, not a spinner */}
          {ocrLoading && !isScanned && (
            <View style={styles.scanningOverlay}>
              <View style={styles.scanBadge}>
                <Text style={styles.scanBadgeText}>识别中</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [selectedSet, flaggedUris, scannedUris, ocrLoading, toggle],
  );

  const keyExtractor = useCallback((item: PhotoAsset) => item.uri, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onCancel}
    >
      <SafeAreaView style={styles.safe}>
        {/* Header — with platform-aware top margin */}
        <View style={[styles.header, { marginTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 32) : 0 }]}>
          <TouchableOpacity onPress={onCancel} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>取消</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            已选 {selectedCount}/{photos.length} 张
          </Text>
          <TouchableOpacity onPress={selectAll} style={styles.headerButton}>
            <Text style={styles.headerConfirmText}>全选</Text>
          </TouchableOpacity>
        </View>

        {/* Guidance banner — auto-dismisses */}
        {showBanner && (
          <View style={styles.banner}>
            <View style={styles.bannerContent}>
              <Text style={styles.bannerTitle}>智能筛选已开启</Text>
              <Text style={styles.bannerText}>
                绿色边框 = 正常照片，红色边框 = 疑似截图（自动取消选中）
              </Text>
              <Text style={styles.bannerText}>
                随时点击照片手动调整选择
              </Text>
            </View>
            <TouchableOpacity onPress={() => setShowBanner(false)} style={styles.bannerClose}>
              <Text style={styles.bannerCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* OCR Progress Bar — minimal */}
        {ocrLoading && ocrProgress && (
          <View style={styles.ocrBar}>
            <View style={[styles.ocrBarFill, { width: `${Math.round((ocrProgress.current / ocrProgress.total) * 100)}%` }]} />
          </View>
        )}

        {/* OCR Summary */}
        {(scannedUris && scannedUris.size > 0) && (
          <View style={styles.ocrSummary}>
            <View style={styles.ocrSummaryDot} />
            <Text style={styles.ocrSummaryText}>
              {flaggedCount > 0
                ? `智能过滤已标记 ${flaggedCount} 张截图`
                : `已扫描 ${scannedUris.size}/${photos.length} 张，未检测到截图`}
            </Text>
          </View>
        )}

        {/* Legend — subtle color hints */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: 'rgba(39, 174, 96, 0.6)' }]} />
            <Text style={styles.legendText}>照片</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: 'rgba(233, 69, 96, 0.75)' }]} />
            <Text style={styles.legendText}>截图</Text>
          </View>
        </View>

        {/* Photo Grid */}
        <FlatList
          data={photos}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={3}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={styles.row}
          getItemLayout={(_, index) => ({
            length: ITEM_SIZE,
            offset: ITEM_SIZE * Math.floor(index / 3),
            index,
          })}
        />

        {/* Bottom confirm */}
        <View style={styles.footer}>
          <TouchableOpacity onPress={handleConfirm} style={styles.confirmButton} activeOpacity={0.8}>
            <Text style={styles.confirmText}>开始分析({selectedCount}张)</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const ITEM_SIZE = 120;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1a1a2e' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerButton: { minWidth: 60 },
  headerButtonText: { color: 'rgba(255,255,255,0.6)', fontSize: 16 },
  headerTitle: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  headerConfirmText: { color: '#e94560', fontSize: 16, fontWeight: '600', textAlign: 'right' },

  // Banner
  banner: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginTop: 8,
    backgroundColor: 'rgba(233, 69, 96, 0.12)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(233, 69, 96, 0.25)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bannerContent: { flex: 1, gap: 4 },
  bannerTitle: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  bannerText: { color: 'rgba(255,255,255,0.5)', fontSize: 11, lineHeight: 16 },
  bannerClose: {
    paddingLeft: 10,
    paddingVertical: 4,
    justifyContent: 'flex-start',
  },
  bannerCloseText: { color: 'rgba(255,255,255,0.3)', fontSize: 16 },

  // OCR progress bar (hairline)
  ocrBar: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  ocrBarFill: {
    height: '100%',
    backgroundColor: '#e94560',
    borderRadius: 1,
  },

  // OCR summary (one-liner)
  ocrSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  ocrSummaryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e94560',
  },
  ocrSummaryText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },

  // Legend
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 8,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: 'rgba(255,255,255,0.3)', fontSize: 10 },

  // Grid
  grid: { paddingHorizontal: 4, paddingTop: 6 },
  row: { gap: 3 },

  photoItem: {
    flex: 1,
    aspectRatio: 1,
    margin: 2,
    borderRadius: 10,
    overflow: 'visible',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  photoInner: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 3,
  },
  thumbnail: { width: '100%', height: '100%' },

  // Scanning state
  scanningOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBadge: {
    backgroundColor: 'rgba(233, 69, 96, 0.8)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  scanBadgeText: { color: '#ffffff', fontSize: 9, fontWeight: '700', letterSpacing: 1 },

  // Checkbox
  checkbox: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    borderColor: '#e94560',
    backgroundColor: '#e94560',
  },
  checkmark: { color: '#ffffff', fontSize: 14, fontWeight: '700' },

  footer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  confirmButton: {
    backgroundColor: '#e94560',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});

export default PhotoPicker;
