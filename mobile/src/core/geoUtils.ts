import { BoundingBox, MunicipalityFeature } from './types';

/**
 * Calculates great-circle distance between two coordinates in kilometers using Haversine formula.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Computes bounding box enclosing all coordinates in GeoJSON features.
 */
export function computeBoundingBox(features: MunicipalityFeature[]): BoundingBox {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  function traverseCoords(coords: any) {
    if (
      Array.isArray(coords) &&
      coords.length >= 2 &&
      typeof coords[0] === 'number' &&
      typeof coords[1] === 'number'
    ) {
      const lng = coords[0];
      const lat = coords[1];
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      return;
    }
    if (Array.isArray(coords)) {
      for (let i = 0; i < coords.length; i++) {
        traverseCoords(coords[i]);
      }
    }
  }

  for (let i = 0; i < features.length; i++) {
    traverseCoords(features[i].geometry.coordinates);
  }

  return { minLng, maxLng, minLat, maxLat };
}

/**
 * Transforms WGS84 geographic coordinate into 2D SVG canvas coordinates with inverted Y-axis.
 */
export function geoToSvgCoordinates(
  lng: number,
  lat: number,
  bounds: BoundingBox,
  width: number,
  height: number,
  padding: number = 0,
): { x: number; y: number } {
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  const lngSpan = bounds.maxLng - bounds.minLng || 1;
  const latSpan = bounds.maxLat - bounds.minLat || 1;

  const normX = (lng - bounds.minLng) / lngSpan;
  const normY = (bounds.maxLat - lat) / latSpan; // Invert Y since SVG origin is top-left

  const x = padding + normX * usableWidth;
  const y = padding + normY * usableHeight;

  return { x, y };
}

/**
 * Formats a numerical amount into Philippine Peso currency representation.
 */
export function formatCurrencyPHP(amount: number): string {
  if (isNaN(amount)) return '₱ 0';
  const rounded = Math.round(amount);
  const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `₱ ${formatted}`;
}

/**
 * Normalizes LGU names to standard title form for deterministic matching.
 * e.g., 'City of Bogo' -> 'Bogo City', 'Carcar City' -> 'Carcar City'
 */
export function normalizeLguName(name: string): string {
  if (!name) return '';
  const trimmed = name.trim();
  if (/^city of\s+/i.test(trimmed)) {
    const raw = trimmed.replace(/^city of\s+/i, '').trim();
    return `${raw} City`;
  }
  return trimmed;
}
