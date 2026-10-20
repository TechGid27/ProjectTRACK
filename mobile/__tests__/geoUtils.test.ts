import {
  normalizeLguName,
  formatCurrencyPHP,
  haversineDistance,
  checkGeofenceProximity,
  clusterPins,
  geoToSvgCoordinates,
} from '../src/core/geoUtils';

describe('geoUtils suite', () => {
  describe('normalizeLguName', () => {
    test('normalizes "City of Bogo" to "Bogo City"', () => {
      expect(normalizeLguName('City of Bogo')).toBe('Bogo City');
    });

    test('preserves already normalized names', () => {
      expect(normalizeLguName('Carcar City')).toBe('Carcar City');
      expect(normalizeLguName('San Fernando')).toBe('San Fernando');
    });

    test('handles empty or blank input', () => {
      expect(normalizeLguName('')).toBe('');
    });
  });

  describe('formatCurrencyPHP', () => {
    test('formats numbers into PHP currency strings', () => {
      expect(formatCurrencyPHP(49000000)).toBe('₱ 49,000,000');
      expect(formatCurrencyPHP(1250000)).toBe('₱ 1,250,000');
    });

    test('handles 0 and NaN gracefully', () => {
      expect(formatCurrencyPHP(0)).toBe('₱ 0');
      expect(formatCurrencyPHP(NaN)).toBe('₱ 0');
    });
  });

  describe('haversineDistance & checkGeofenceProximity', () => {
    test('computes distance between two coordinates accurately', () => {
      // Distance between Bogo and Danao is roughly ~58km
      const dist = haversineDistance(11.0505, 124.0055, 10.528, 123.938);
      expect(dist).toBeGreaterThan(50);
      expect(dist).toBeLessThan(70);
    });

    test('detects when user is inside 150m geofence', () => {
      const target = { lat: 11.0505, lng: 124.0055 };
      // ~45m offset (approx 0.0004 deg)
      const user = { lat: 11.0509, lng: 124.0055 };

      const res = checkGeofenceProximity(target.lat, target.lng, user.lat, user.lng, 150);
      expect(res.isInside).toBe(true);
      expect(res.distanceMeters).toBeLessThanOrEqual(150);
    });

    test('detects when user is outside 150m geofence', () => {
      const target = { lat: 11.0505, lng: 124.0055 };
      // ~300m offset (approx 0.003 deg)
      const user = { lat: 11.0535, lng: 124.0055 };

      const res = checkGeofenceProximity(target.lat, target.lng, user.lat, user.lng, 150);
      expect(res.isInside).toBe(false);
      expect(res.distanceMeters).toBeGreaterThan(150);
    });
  });

  describe('clusterPins', () => {
    test('does not cluster when scale > 1.25', () => {
      const pins = [
        { id: 'p1', x: 100, y: 100 },
        { id: 'p2', x: 105, y: 105 },
        { id: 'p3', x: 200, y: 200 },
        { id: 'p4', x: 300, y: 300 },
        { id: 'p5', x: 400, y: 400 },
      ];

      const clusters = clusterPins(pins, 1.5, 28);
      expect(clusters.length).toBe(5);
      expect(clusters.every((c) => !c.isCluster)).toBe(true);
    });

    test('groups nearby pins into cluster when scale <= 1.25 and count > 4', () => {
      const pins = [
        { id: 'p1', x: 100, y: 100 },
        { id: 'p2', x: 105, y: 105 }, // close to p1
        { id: 'p3', x: 110, y: 108 }, // close to p1
        { id: 'p4', x: 250, y: 250 },
        { id: 'p5', x: 350, y: 350 },
      ];

      const clusters = clusterPins(pins, 1.0, 28);
      // p1, p2, p3 should be grouped together into 1 cluster
      const grouped = clusters.find((c) => c.isCluster);
      expect(grouped).toBeDefined();
      expect(grouped?.count).toBe(3);
      expect(grouped?.pinIds).toEqual(['p1', 'p2', 'p3']);
    });
  });

  describe('geoToSvgCoordinates', () => {
    test('projects coordinates into bounding box bounds', () => {
      const bounds = { minLng: 123.0, maxLng: 124.0, minLat: 9.0, maxLat: 11.0 };
      const coord = geoToSvgCoordinates(123.5, 10.0, bounds, 400, 600, 0);

      // Midpoint in lng (123.5) should be width / 2 = 200
      expect(coord.x).toBe(200);
      // Midpoint in lat (10.0) should be height / 2 = 300
      expect(coord.y).toBe(300);
    });
  });
});
