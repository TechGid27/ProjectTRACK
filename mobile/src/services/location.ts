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
    // Reuse an existing grant without re-prompting (a second prompt while the
    // first dialog is still open silently resolves as undetermined).
    if (typeof Location.getForegroundPermissionsAsync === 'function') {
      const existing = await Location.getForegroundPermissionsAsync();
      if (existing?.status === 'granted') return true;
      if (existing?.status === 'denied' && !existing.canAskAgain) return false;
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

function toDeviceFix(pos: {
  coords: { latitude: number; longitude: number; accuracy?: number | null };
}): DeviceFix {
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: pos.coords.accuracy ?? null,
  };
}

/**
 * Read a hardware GPS fix, or null if unavailable/denied.
 * Falls back gracefully: high accuracy → last known position → balanced
 * accuracy, so a cold GPS start doesn't leave the field auditor stuck.
 */
export async function getDeviceFix(): Promise<DeviceFix | null> {
  try {
    const granted = await requestLocationPermission();
    if (!granted) return null;

    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      return toDeviceFix(pos);
    } catch {
      // Cold GPS start: an instant last-known fix is still valid for geofencing
      try {
        const last = await Location.getLastKnownPositionAsync();
        if (last) return toDeviceFix(last);
      } catch {
        // ignore and try balanced accuracy below
      }
    }

    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return toDeviceFix(pos);
    } catch {
      return null;
    }
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
