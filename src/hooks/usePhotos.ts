import { useState, useEffect, useCallback, useRef } from 'react';
import * as MediaLibrary from 'expo-media-library';
import { TimePeriod } from '../types';

export interface UsePhotosResult {
  /** Current permission status, or null if not yet checked */
  permission: MediaLibrary.PermissionResponse | null;
  /** Request photo library permission from the user */
  requestPermission: () => Promise<MediaLibrary.PermissionResponse>;
  /** Fetched photo assets matching the time period */
  photos: MediaLibrary.Asset[];
  /** Whether photos are currently being loaded */
  loading: boolean;
  /** Manually trigger a reload of photos for the current time period */
  reload: () => Promise<void>;
}

/**
 * Hook to manage photo library permission and fetch photos within a time period.
 *
 * On mount, checks current permission status. If already granted, automatically
 * loads photos for the given TimePeriod. Use `reload()` to refresh after date
 * changes, and `requestPermission()` to prompt the user when permission is denied.
 */
export function usePhotos({ startDate, endDate }: TimePeriod): UsePhotosResult {
  const [permission, setPermission] = useState<MediaLibrary.PermissionResponse | null>(null);
  const [photos, setPhotos] = useState<MediaLibrary.Asset[]>([]);
  const [loading, setLoading] = useState(false);

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    try {
      const result = await MediaLibrary.getAssetsAsync({
        first: 500,
        createdAfter: startDate.getTime(),
        createdBefore: endDate.getTime(),
        mediaType: 'photo',
        sortBy: [MediaLibrary.SortBy.creationTime],
      });
      setPhotos(result.assets);
    } catch (error) {
      console.error('Failed to load photos:', error);
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  // Keep a ref to the latest loadPhotos so the mount effect always calls the
  // current version (with the correct startDate/endDate in closure).
  const loadPhotosRef = useRef(loadPhotos);
  loadPhotosRef.current = loadPhotos;

  const requestPermission = useCallback(async () => {
    const response = await MediaLibrary.requestPermissionsAsync();
    setPermission(response);
    return response;
  }, []);

  const reload = useCallback(async () => {
    await loadPhotos();
  }, [loadPhotos]);

  // On mount: check existing permission. If already granted, auto-load photos.
  useEffect(() => {
    let mounted = true;
    (async () => {
      const response = await MediaLibrary.getPermissionsAsync();
      if (!mounted) return;
      setPermission(response);
      if (response.granted) {
        await loadPhotosRef.current();
      }
    })();
    return () => {
      mounted = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { permission, requestPermission, photos, loading, reload };
}
