import { describe, it, expect } from 'vitest'
import { clusterByProximity, degreesPerPixel } from './cluster'

const id = (p) => [p.lat, p.lng]

describe('clusterByProximity', () => {
  it('groups points that are close but NOT identical at low zoom', () => {
    // ~15 m apart: different 4-decimal grid cells, but visually overlapping.
    const points = [
      { name: 'A', lat: 10.3157, lng: 123.8854 },
      { name: 'B', lat: 10.3158, lng: 123.8855 },
    ]
    const clusters = clusterByProximity(points, 13, id)
    expect(clusters).toHaveLength(1)
    expect(clusters[0].items).toHaveLength(2)
  })

  it('separates the same points when zoomed in close', () => {
    const points = [
      { name: 'A', lat: 10.3157, lng: 123.8854 },
      { name: 'B', lat: 10.3158, lng: 123.8855 },
    ]
    const clusters = clusterByProximity(points, 19, id)
    expect(clusters.length).toBeGreaterThan(1)
  })

  it('keeps far-apart points in separate clusters', () => {
    const points = [
      { name: 'A', lat: 10.3157, lng: 123.8854 },
      { name: 'B', lat: 10.4500, lng: 123.9900 },
    ]
    const clusters = clusterByProximity(points, 13, id)
    expect(clusters).toHaveLength(2)
  })

  it('skips points with missing coordinates', () => {
    const points = [
      { name: 'A', lat: 10.3157, lng: 123.8854 },
      { name: 'B', lat: null, lng: 123.9 },
    ]
    const clusters = clusterByProximity(points, 13, id)
    expect(clusters).toHaveLength(1)
    expect(clusters[0].items).toHaveLength(1)
  })

  it('degreesPerPixel shrinks as zoom increases', () => {
    expect(degreesPerPixel(10)).toBeGreaterThan(degreesPerPixel(16))
  })
})
