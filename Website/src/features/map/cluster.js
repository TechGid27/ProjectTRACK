/**
 * Zoom-aware proximity clustering for map markers.
 *
 * The map previously grouped markers only when their coordinates were identical
 * to 4 decimals (~11 m), so projects that are *close but not identical* still
 * rendered as overlapping pins. This clusters points that fall within a small
 * SCREEN distance at the current zoom, so overlapping pins merge into one and
 * naturally separate again as the user zooms in.
 */

// Web-Mercator tile math: at zoom z the whole 360deg of longitude spans
// 256 * 2^z pixels, so this is the longitude-degrees covered by one pixel.
export function degreesPerPixel(zoom) {
  const safeZoom = Number.isFinite(zoom) ? zoom : 13
  return 360 / (256 * Math.pow(2, safeZoom))
}

/**
 * Cluster points whose on-screen separation is within `pixelThreshold` px.
 *
 * @param {Array} points        Arbitrary point objects.
 * @param {number} zoom         Current Leaflet zoom level.
 * @param {(p:any)=>[number,number]} getLatLng  Returns [lat, lng] for a point.
 * @param {number} [pixelThreshold=22]  Merge distance in screen pixels.
 * @returns {Array<{lat:number,lng:number,items:any[]}>} clusters with a
 *          representative centroid-ish anchor (first/most prominent point's
 *          coordinate) and the grouped items.
 */
export function clusterByProximity(points, zoom, getLatLng, pixelThreshold = 22) {
  const list = Array.isArray(points) ? points : []
  const dpp = degreesPerPixel(zoom)
  // Convert the pixel threshold to a longitude-degree threshold. Latitude uses
  // the same dpp (Mercator y is nonlinear, but over a city extent the error is
  // negligible and we only need approximate screen proximity).
  const thresholdDeg = pixelThreshold * dpp

  const clusters = []
  for (const p of list) {
    const ll = getLatLng(p)
    if (!ll || ll[0] == null || ll[1] == null) continue
    const [lat, lng] = [Number(ll[0]), Number(ll[1])]
    if (Number.isNaN(lat) || Number.isNaN(lng)) continue

    // Longitude distance shrinks with latitude; scale the lng comparison.
    const cosLat = Math.cos((lat * Math.PI) / 180) || 1

    let placed = false
    for (const c of clusters) {
      const dLat = Math.abs(lat - c.lat)
      const dLng = Math.abs(lng - c.lng) * cosLat
      if (dLat <= thresholdDeg && dLng <= thresholdDeg) {
        c.items.push(p)
        placed = true
        break
      }
    }
    if (!placed) {
      clusters.push({ lat, lng, items: [p] })
    }
  }
  return clusters
}
