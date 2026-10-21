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

export interface GeofenceResult {
  isInside: boolean;
  distanceMeters: number;
}

/**
 * Checks if a user's location is within a defined geofence radius (default 150m) of a target coordinate.
 */
export function checkGeofenceProximity(
  targetLat: number,
  targetLng: number,
  userLat: number,
  userLng: number,
  maxRadiusMeters: number = 150,
): GeofenceResult {
  const distanceKm = haversineDistance(userLat, userLng, targetLat, targetLng);
  const distanceMeters = Math.round(distanceKm * 1000);
  return {
    isInside: distanceMeters <= maxRadiusMeters,
    distanceMeters,
  };
}

export interface ClusteredPinItem {
  id: string;
  isCluster: boolean;
  count: number;
  pinIds: string[];
  x: number;
  y: number;
  pins: any[];
}

/**
 * Clusters rendered SVG pins based on pixel proximity when map zoom scale is low.
 */
export function clusterPins(
  renderedPins: any[],
  scale: number,
  distanceThreshold: number = 28,
): ClusteredPinItem[] {
  if (scale > 1.25 || renderedPins.length <= 4) {
    return renderedPins.map((p) => ({
      id: p.id,
      isCluster: false,
      count: 1,
      pinIds: [p.id],
      x: p.x,
      y: p.y,
      pins: [p],
    }));
  }

  const clusters: ClusteredPinItem[] = [];
  const visited = new Set<string>();

  for (let i = 0; i < renderedPins.length; i++) {
    const current = renderedPins[i];
    if (visited.has(current.id)) continue;

    const clusterGroup = [current];
    visited.add(current.id);

    for (let j = i + 1; j < renderedPins.length; j++) {
      const other = renderedPins[j];
      if (visited.has(other.id)) continue;

      const dx = current.x - other.x;
      const dy = current.y - other.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= distanceThreshold) {
        clusterGroup.push(other);
        visited.add(other.id);
      }
    }

    if (clusterGroup.length > 1) {
      const avgX =
        clusterGroup.reduce((sum, p) => sum + p.x, 0) / clusterGroup.length;
      const avgY =
        clusterGroup.reduce((sum, p) => sum + p.y, 0) / clusterGroup.length;

      clusters.push({
        id: `cluster-${clusterGroup.map((p) => p.id).join('-')}`,
        isCluster: true,
        count: clusterGroup.length,
        pinIds: clusterGroup.map((p) => p.id),
        x: avgX,
        y: avgY,
        pins: clusterGroup,
      });
    } else {
      clusters.push({
        id: current.id,
        isCluster: false,
        count: 1,
        pinIds: [current.id],
        x: current.x,
        y: current.y,
        pins: [current],
      });
    }
  }

  return clusters;
}

/**
 * Applies deterministic micro-dispersion to pins that share near-identical
 * coordinates on screen. At zoom scales >= 1.4, co-located pins fan out in
 * a circular orbit so each project remains visible and individually clickable.
 */
export function disperseCoLocatedPins<T extends { id: string; x: number; y: number }>(
  pins: T[],
  scale: number,
  proximityThreshold: number = 14,
): T[] {
  if (pins.length <= 1 || scale < 1.4) {
    return pins;
  }

  const groups: T[][] = [];
  const assigned = new Set<string>();

  for (let i = 0; i < pins.length; i++) {
    const p1 = pins[i];
    if (assigned.has(p1.id)) continue;

    const group = [p1];
    assigned.add(p1.id);

    for (let j = i + 1; j < pins.length; j++) {
      const p2 = pins[j];
      if (assigned.has(p2.id)) continue;

      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      if (Math.hypot(dx, dy) <= proximityThreshold) {
        group.push(p2);
        assigned.add(p2.id);
      }
    }

    groups.push(group);
  }

  const result: T[] = [];
  const spreadRadius = Math.max(10, 16 / Math.sqrt(scale));

  for (const group of groups) {
    if (group.length === 1) {
      result.push(group[0]);
    } else {
      const centerX = group.reduce((sum, p) => sum + p.x, 0) / group.length;
      const centerY = group.reduce((sum, p) => sum + p.y, 0) / group.length;

      group.forEach((pin, idx) => {
        const angle = (idx * 2 * Math.PI) / group.length;
        result.push({
          ...pin,
          x: centerX + spreadRadius * Math.cos(angle),
          y: centerY + spreadRadius * Math.sin(angle),
        });
      });
    }
  }

  return result;
}
