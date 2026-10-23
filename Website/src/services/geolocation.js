// Default overall budget for acquiring a position. Split across a quick
// high-accuracy attempt and a longer coarse fallback (see below).
const GEOLOCATION_TIMEOUT_MS = 20000
// The quick first pass: on phones this gets a precise GPS fix fast; on devices
// without GPS it fails quickly so we can fall back to coarse positioning.
const HIGH_ACCURACY_FIRST_PASS_MS = 6000

/**
 * Reason codes for a geolocation attempt that did not return coordinates.
 * @typedef {'unsupported' | 'insecure_context' | 'denied' | 'unavailable' | 'timeout' | 'invalid'} GeolocationFailure
 */

/** Human-readable, actionable guidance for each geolocation failure reason. */
export function geolocationFailureMessage(reason) {
  switch (reason) {
    case 'insecure_context':
      return 'GPS needs a secure page — open the site over HTTPS or on localhost (browsers block location on plain http:// addresses).'
    case 'denied':
      return 'Location permission was denied. Allow location for this site in your browser, then retry.'
    case 'timeout':
      return "Couldn't get your location in time. Make sure location services are on — on-site field reports work best from a phone with GPS."
    case 'unavailable':
      return 'Your device could not determine a location (no GPS/Wi-Fi fix available). Retry, or submit without GPS.'
    case 'unsupported':
      return 'This browser does not support geolocation.'
    case 'invalid':
      return 'GPS returned an invalid position. Please retry.'
    default:
      return 'No GPS available — your report will be submitted as unverified.'
  }
}

function isFiniteCoord(n) {
  return typeof n === 'number' && Number.isFinite(n)
}

function getPositionOnce(options) {
  return new Promise((resolve) => {
    let settled = false
    const done = (value) => {
      if (!settled) {
        settled = true
        resolve(value)
      }
    }
    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords
          if (isFiniteCoord(latitude) && isFiniteCoord(longitude)) {
            done({ ok: true, latitude, longitude, accuracy })
          } else {
            done({ ok: false, reason: 'invalid' })
          }
        },
        (error) => {
          // GeolocationPositionError: PERMISSION_DENIED=1,
          // POSITION_UNAVAILABLE=2, TIMEOUT=3.
          const reason =
            error?.code === 1
              ? 'denied'
              : error?.code === 3
                ? 'timeout'
                : 'unavailable'
          done({ ok: false, reason })
        },
        options,
      )
    } catch {
      // Some browsers throw synchronously on an insecure origin.
      done({ ok: false, reason: 'insecure_context' })
    }
  })
}

/**
 * Detailed capture: resolves with `{ ok: true, latitude, longitude, accuracy }`
 * on success, or `{ ok: false, reason }` explaining WHY it failed. Never
 * rejects.
 *
 * Strategy (robust across phones AND desktops):
 *   1. A short high-accuracy pass — fast, precise GPS on phones.
 *   2. If that fails (common on desktops with no GPS chip), fall back to a
 *      coarse, cache-tolerant pass with the remaining time budget. This lets
 *      Wi-Fi / IP based positioning succeed instead of timing out.
 *
 * Permission denial short-circuits (no point retrying). Insecure contexts are
 * reported explicitly so the UI can tell the user to use HTTPS/localhost.
 *
 * @param {number} timeoutMs overall budget
 * @returns {Promise<{ok: true, latitude: number, longitude: number, accuracy?: number} | {ok: false, reason: GeolocationFailure}>}
 */
export async function captureGeolocationDetailed(timeoutMs = GEOLOCATION_TIMEOUT_MS) {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    const insecure =
      typeof window !== 'undefined' && window.isSecureContext === false
    return { ok: false, reason: insecure ? 'insecure_context' : 'unsupported' }
  }
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return { ok: false, reason: 'insecure_context' }
  }

  const firstPass = Math.min(HIGH_ACCURACY_FIRST_PASS_MS, timeoutMs)
  const highAccuracy = await getPositionOnce({
    enableHighAccuracy: true,
    timeout: firstPass,
    maximumAge: 0,
  })
  if (highAccuracy.ok) return highAccuracy

  // Don't retry a denial or an insecure context — the outcome won't change.
  if (highAccuracy.reason === 'denied' || highAccuracy.reason === 'insecure_context') {
    return highAccuracy
  }

  // Coarse fallback with the remaining budget: tolerate a cached position and
  // drop the high-accuracy requirement so Wi-Fi/IP positioning can answer.
  const remaining = Math.max(8000, timeoutMs - firstPass)
  const coarse = await getPositionOnce({
    enableHighAccuracy: false,
    timeout: remaining,
    maximumAge: 60000,
  })
  return coarse
}

/**
 * Capture the browser's current position for geofence-verified anomaly reports.
 *
 * Never rejects: resolves with `{ latitude, longitude }` on success and `null`
 * on any failure, so report submission proceeds gracefully (the backend accepts
 * no-GPS submissions and tags them `unverified_no_gps`). Backed by
 * captureGeolocationDetailed(); callers that need the failure reason should use
 * that directly.
 */
export async function captureGeolocation(timeoutMs = GEOLOCATION_TIMEOUT_MS) {
  const result = await captureGeolocationDetailed(timeoutMs)
  return result.ok
    ? { latitude: result.latitude, longitude: result.longitude }
    : null
}
