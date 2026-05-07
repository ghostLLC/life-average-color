import { useState, useEffect, useCallback, useRef } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import type { TimePeriod, PhotoAsset } from '../types';

export interface UsePhotosResult {
  permission: boolean | null;
  requestPermission: () => Promise<boolean>;
  photos: PhotoAsset[];
  loading: boolean;
  reload: () => Promise<void>;
}

async function checkPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (Platform.Version >= 33) {
    return PermissionsAndroid.check('android.permission.READ_MEDIA_IMAGES');
  }
  return PermissionsAndroid.check('android.permission.READ_EXTERNAL_STORAGE');
}

async function requestPermissionImpl(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const permission = Platform.Version >= 33
    ? 'android.permission.READ_MEDIA_IMAGES'
    : 'android.permission.READ_EXTERNAL_STORAGE';
  const result = await PermissionsAndroid.request(permission as any);
  return result === 'granted';
}

export function usePhotos({ startDate, endDate }: TimePeriod): UsePhotosResult {
  const [permission, setPermission] = useState<boolean | null>(null);
  const [photos, setPhotos] = useState<PhotoAsset[]>([]);
  const [loading, setLoading] = useState(false);

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    try {
      const result = await CameraRoll.getPhotos({
        first: 500,
        assetType: 'Photos',
        fromTime: startDate.getTime(),
        toTime: endDate.getTime(),
        include: ['filename', 'imageSize'],
      });
      const assets: PhotoAsset[] = result.edges.map((edge) => ({
        uri: edge.node.image.uri,
        filename: edge.node.image.filename || '',
        width: edge.node.image.width,
        height: edge.node.image.height,
        creationTime: edge.node.timestamp * 1000,
      }));
      setPhotos(assets);
    } catch (error) {
      console.error('Failed to load photos:', error);
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  const loadPhotosRef = useRef(loadPhotos);
  loadPhotosRef.current = loadPhotos;

  const requestPermission = useCallback(async () => {
    const granted = await requestPermissionImpl();
    setPermission(granted);
    return granted;
  }, []);

  const reload = useCallback(async () => {
    await loadPhotos();
  }, [loadPhotos]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const granted = await checkPermission();
      if (!mounted) return;
      setPermission(granted);
      if (granted) {
        await loadPhotosRef.current();
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return { permission, requestPermission, photos, loading, reload };
}
