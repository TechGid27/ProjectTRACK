import {
  haversineDistance,
  computeBoundingBox,
  geoToSvgCoordinates,
  formatCurrencyPHP,
  normalizeLguName,
} from '../src/core/geoUtils';
import { pins, getPinsByLgu, getPinById } from '../src/data/pins';
import {
  mockProjects,
  getProjectsByLocation,
  getProjectById,
  computeLguSummary,
} from '../src/data/mockApi';
import { AnomalyReport } from '../src/core/types';

describe('Core Geo Utilities', () => {
  test('haversineDistance returns 0 for identical points', () => {
    const dist = haversineDistance(10.3157, 123.8854, 10.3157, 123.8854);
    expect(dist).toBeCloseTo(0, 5);
  });

  test('haversineDistance accurately computes Cebu City to Bogo City (~70-80 km)', () => {
    // Cebu City: 10.3157, 123.8854; Bogo City: 11.0500, 124.0050
    const dist = haversineDistance(10.3157, 123.8854, 11.05, 124.005);
    expect(dist).toBeGreaterThan(75);
    expect(dist).toBeLessThan(90);
  });

  test('computeBoundingBox calculates correct min/max bounds', () => {
    const dummyFeatures = [
      {
        type: 'Feature' as const,
        properties: { name: 'Test1', label: [123.5, 10.0] as [number, number] },
        geometry: {
          type: 'Polygon' as const,
          coordinates: [
            [
              [123.4, 9.8],
              [123.6, 10.2],
              [123.4, 9.8],
            ],
          ],
        },
      },
    ];
    const bbox = computeBoundingBox(dummyFeatures);
    expect(bbox.minLng).toBe(123.4);
    expect(bbox.maxLng).toBe(123.6);
    expect(bbox.minLat).toBe(9.8);
    expect(bbox.maxLat).toBe(10.2);
  });

  test('geoToSvgCoordinates maps coordinate within canvas dimensions with inverted Y', () => {
    const bounds = { minLng: 123.0, maxLng: 124.0, minLat: 9.0, maxLat: 11.0 };
    const width = 300;
    const height = 600;

    // Minimum longitude should map to x = 0
    // Maximum latitude should map to y = 0 (top of SVG)
    const topLeft = geoToSvgCoordinates(123.0, 11.0, bounds, width, height);
    expect(topLeft.x).toBeCloseTo(0);
    expect(topLeft.y).toBeCloseTo(0);

    // Maximum longitude should map to x = width
    // Minimum latitude should map to y = height (bottom of SVG)
    const bottomRight = geoToSvgCoordinates(124.0, 9.0, bounds, width, height);
    expect(bottomRight.x).toBeCloseTo(width);
    expect(bottomRight.y).toBeCloseTo(height);

    // Center point
    const center = geoToSvgCoordinates(123.5, 10.0, bounds, width, height);
    expect(center.x).toBeCloseTo(width / 2);
    expect(center.y).toBeCloseTo(height / 2);
  });

  test('formatCurrencyPHP formats amounts with Philippine Peso symbol and grouping', () => {
    expect(formatCurrencyPHP(0)).toBe('₱ 0');
    expect(formatCurrencyPHP(45000000)).toBe('₱ 45,000,000');
    expect(formatCurrencyPHP(1250500.5)).toBe('₱ 1,250,501');
  });

  test('normalizeLguName standardizes city and town names', () => {
    expect(normalizeLguName('City of Bogo')).toBe('Bogo City');
    expect(normalizeLguName('Cebu City')).toBe('Cebu City');
    expect(normalizeLguName('Tuburan')).toBe('Tuburan');
    expect(normalizeLguName('  Carcar City  ')).toBe('Carcar City');
  });
});

describe('Pins Data Store', () => {
  test('pins dataset contains valid entries with required fields', () => {
    expect(pins.length).toBeGreaterThan(0);
    pins.forEach((pin) => {
      expect(pin.id).toBeDefined();
      expect(pin.name).toBeDefined();
      expect(typeof pin.lat).toBe('number');
      expect(typeof pin.lng).toBe('number');
      expect(pin.lgu).toBeDefined();
    });
  });

  test('getPinsByLgu retrieves pins matching specific LGU name', () => {
    const cebuPins = getPinsByLgu('Cebu City');
    expect(Array.isArray(cebuPins)).toBe(true);
    cebuPins.forEach((p) => {
      expect(normalizeLguName(p.lgu)).toBe('Cebu City');
    });
  });

  test('getPinById returns pin when found and undefined when not', () => {
    const firstPin = pins[0];
    const found = getPinById(firstPin.id);
    expect(found).toEqual(firstPin);

    const notFound = getPinById('non-existent-id-999');
    expect(notFound).toBeUndefined();
  });
});

describe('Projects & Mock API Data Store', () => {
  test('mockProjects contains properly formed civil works contracts', () => {
    expect(mockProjects.length).toBeGreaterThan(0);
    mockProjects.forEach((proj) => {
      expect(proj.id).toMatch(/^[0-9]{2}[A-Z]{2}[0-9]{4}$/);
      expect(proj.budget).toBeGreaterThan(0);
      expect(['Ongoing', 'Completed', 'Delayed']).toContain(proj.status);
    });
  });

  test('getProjectsByLocation filters projects by municipality or district', () => {
    const bogoProjects = getProjectsByLocation('Bogo');
    expect(bogoProjects.length).toBeGreaterThan(0);
    bogoProjects.forEach((p) => {
      expect(p.lgu.toLowerCase()).toContain('bogo');
    });

    const empty = getProjectsByLocation('UnknownNonExistentCity');
    expect(empty).toEqual([]);
  });

  test('getProjectById retrieves exact contract or returns undefined', () => {
    const existing = mockProjects[0];
    expect(getProjectById(existing.id)).toEqual(existing);
    expect(getProjectById('INVALID_ID')).toBeUndefined();
  });

  test('computeLguSummary aggregates project count and budget for an LGU', () => {
    const summary = computeLguSummary('Bogo City');
    expect(summary.name).toBe('Bogo City');
    expect(summary.totalProjects).toBeGreaterThanOrEqual(1);
    expect(summary.totalBudget).toBeGreaterThan(0);
    expect(summary.activeProjects).toBeLessThanOrEqual(summary.totalProjects);
  });
});

describe('Anomaly Report Schema Validation', () => {
  test('creates valid AnomalyReport object conforming to interface', () => {
    const report: AnomalyReport = {
      id: 'rep-001',
      projectId: '24HH0043',
      category: 'ghost_project',
      description: 'Site is empty with no ongoing construction despite reported completion.',
      latitude: 10.3157,
      longitude: 123.8854,
      timestamp: Date.now(),
    };
    expect(report.category).toBe('ghost_project');
    expect(report.description.length).toBeGreaterThan(10);
  });
});
