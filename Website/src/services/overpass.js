const OVERPASS_ENDPOINTS = [
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]
const OVERPASS_USER_AGENT = 'ProjectTRACK/1.0 (Cebu infrastructure map)'
const BARANGAY_MIN_ZOOM = 12

const cache = new Map()
const FAILURE_TTL = 5 * 60 * 1000
const failureUntil = new Map()

function pointInRing(point, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const intersects =
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

function pointInFeature(point, feature) {
  const geom = feature.geometry
  const polygons =
    geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates
  return polygons.some((rings) => {
    if (!pointInRing(point, rings[0])) return false
    return rings.slice(1).every((hole) => !pointInRing(point, hole))
  })
}

export function featureBbox(feature, pad = 0.01) {
  let minLat = 90
  let maxLat = -90
  let minLng = 180
  let maxLng = -180
  const walk = (coords) => {
    if (typeof coords[0] === 'number') {
      minLng = Math.min(minLng, coords[0])
      maxLng = Math.max(maxLng, coords[0])
      minLat = Math.min(minLat, coords[1])
      maxLat = Math.max(maxLat, coords[1])
      return
    }
    coords.forEach(walk)
  }
  walk(feature.geometry.coordinates)
  return [minLat - pad, minLng - pad, maxLat + pad, maxLng + pad]
}

export function featureCentroid(feature) {
  const geom = feature.geometry
  let ring
  if (geom.type === 'Polygon') {
    ring = geom.coordinates[0]
  } else {
    let best = null
    let bestArea = -1
    for (const poly of geom.coordinates) {
      const candidate = poly[0]
      let area = 0
      for (let i = 0; i < candidate.length - 1; i += 1) {
        area += Math.abs(
          candidate[i][0] * candidate[i + 1][1] -
            candidate[i + 1][0] * candidate[i][1],
        )
      }
      if (area > bestArea) {
        bestArea = area
        best = candidate
      }
    }
    ring = best
  }
  let x = 0
  let y = 0
  for (const [lng, lat] of ring) {
    x += lng
    y += lat
  }
  return [x / ring.length, y / ring.length]
}

async function fetchOverpass(query) {
  const blockedUntil = failureUntil.get('all')
  if (blockedUntil && Date.now() < blockedUntil) {
    throw new Error('Overpass cooling down')
  }
  let lastError = null
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6000)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': OVERPASS_USER_AGENT,
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`)
      const data = await res.json()
      if (!Array.isArray(data.elements)) {
        throw new Error('Overpass returned unexpected payload')
      }
      failureUntil.delete('all')
      return data
    } catch (error) {
      lastError = error
    } finally {
      clearTimeout(timer)
    }
  }
  failureUntil.set('all', Date.now() + FAILURE_TTL)
  throw lastError ?? new Error('All Overpass endpoints failed')
}

function fetchOsmContext(lguFeature) {
  const [south, west, north, east] = featureBbox(lguFeature)
  const query = `[out:json][timeout:25];
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified)$"](${south},${west},${north},${east});
  node["place"~"^(suburb|quarter|village|neighbourhood|hamlet)$"](${south},${west},${north},${east});
);
out geom;`
  return fetchOverpass(query).then((data) => {
    const features = []
    for (const element of data.elements) {
      if (element.type === 'way' && Array.isArray(element.geometry)) {
        features.push({
          type: 'Feature',
          properties: {
            kind: 'road',
            highway: element.tags?.highway,
            name: element.tags?.name ?? null,
          },
          geometry: {
            type: 'LineString',
            coordinates: element.geometry.map((g) => [g.lon, g.lat]),
          },
        })
      } else if (
        element.type === 'node' &&
        element.lat != null &&
        element.lon != null
      ) {
        const name = element.tags?.name
        if (!name) continue
        const point = [element.lon, element.lat]
        if (!pointInFeature(point, lguFeature)) continue
        features.push({
          type: 'Feature',
          properties: { name, kind: 'place' },
          geometry: { type: 'Point', coordinates: point },
        })
      }
    }
    return { type: 'FeatureCollection', features }
  })
}

function cached(key, loader) {
  const existing = cache.get(key)
  if (existing) return existing
  const promise = loader().catch(() => {
    cache.delete(key)
    return null
  })
  cache.set(key, promise)
  return promise
}

export function fetchOsmContextCached(name, lguFeature) {
  return cached(`osm:${name}`, () => fetchOsmContext(lguFeature))
}

export { BARANGAY_MIN_ZOOM }
