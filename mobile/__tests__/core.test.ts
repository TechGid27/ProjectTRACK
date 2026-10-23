import {
  haversineDistance,
  computeBoundingBox,
  geoToSvgCoordinates,
  formatCurrencyPHP,
  normalizeLguName,
  computeMapViewBox,
} from '../src/core/geoUtils';
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

  test('computeMapViewBox drives crisp zoom via viewBox (not raster scaling)', () => {
    const W = 360;
    const H = 480;

    // At scale 1.0 with no offset, the viewBox spans the full canvas.
    const [x0, y0, w0, h0] = computeMapViewBox(1.0, 0, 0, W, H)
      .split(/\s+/)
      .map(Number);
    expect(x0).toBeCloseTo(0, 1);
    expect(y0).toBeCloseTo(0, 1);
    expect(w0).toBeCloseTo(W, 1);
    expect(h0).toBeCloseTo(H, 1);

    // Zooming in SHRINKS the visible span (so vectors re-rasterize larger & crisp).
    const [, , w2, h2] = computeMapViewBox(2.0, 0, 0, W, H)
      .split(/\s+/)
      .map(Number);
    expect(w2).toBeCloseTo(W / 2, 1);
    expect(h2).toBeCloseTo(H / 2, 1);

    // The mapping matches screenX = W/2 + (svgX - W/2)*scale + offsetX.
    // For a point at the canvas center (svgX=W/2, svgY=H/2) with scale 2 and an
    // x-offset of 40, its screen position must equal (W/2 + offsetX).
    const scale = 2;
    const offsetX = 40;
    const [vbMinX, , vbW] = computeMapViewBox(scale, offsetX, 0, W, H)
      .split(/\s+/)
      .map(Number);
    const svgCenterX = W / 2;
    const screenXViaViewBox = ((svgCenterX - vbMinX) / vbW) * W;
    const screenXExpected = W / 2 + (svgCenterX - W / 2) * scale + offsetX;
    expect(screenXViaViewBox).toBeCloseTo(screenXExpected, 1);
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
