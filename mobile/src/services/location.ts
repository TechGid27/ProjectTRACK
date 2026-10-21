/**
 * Hardware Capture Wrappers (Pillar 1 — Physical Presence)
 * ========================================================
 * Thin, mockable wrappers over expo-location and expo-camera so the geofenced
 * shutter can use real device GPS and camera while unit tests can stub these
 * without pulling in native modules.
 */
import * as Location from 'expo-location';
import { Camera } from 'expo-camera';

export interface DeviceFix {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

/** Request foreground location permission; returns true if granted. */
export async function requestLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/** Read a single high-accuracy GPS fix, or null if unavailable/denied. */
export async function getDeviceFix(): Promise<DeviceFix | null> {
  try {
    const granted = await requestLocationPermission();
    if (!granted) return null;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy ?? null,
    };
  } catch {
    return null;
  }
}

/** Request camera permission for the live-only shutter; returns true if granted. */
export async function requestCameraPermission(): Promise<boolean> {
  try {
    const { status } = await Camera.requestCameraPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}
