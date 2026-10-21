const GEOLOCATION_TIMEOUT_MS = 8000

/**
 * Capture the browser's current position for geofence-verified anomaly reports.
 *
 * Never rejects: resolves with `{ latitude, longitude }` on success and
 * `null` on denial, timeout, or unsupported browsers so report submission
 * proceeds gracefully (the backend accepts no-GPS submissions and tags them
 * `unverified_no_gps`).
 */
export function captureGeolocation(timeoutMs = GEOLOCATION_TIMEOUT_MS) {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        if (
          typeof latitude === 'number' &&
          typeof longitude === 'number' &&
          Number.isFinite(latitude) &&
          Number.isFinite(longitude)
        ) {
          resolve({ latitude, longitude })
        } else {
          resolve(null)
        }
      },
      () => resolve(null),
      { timeout: timeoutMs, maximumAge: 0, enableHighAccuracy: true },
    )
  })
}
