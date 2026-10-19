import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearApiCache, fetchMapPoints } from './api'
import { lguQuery } from '../data/projectHelpers'

// Regression guard for cross-LGU dot leakage: selecting an LGU must send the
// FULL canonical name (e.g. "Cebu City") to the backend. The historical bug
// stripped " City" via lguQuery, sending "Cebu" and matching the whole
// province. The backend now isolates by exact (normalized) municipality, so
// the frontend must stop truncating the query value.
describe('map municipality query isolation', () => {
  beforeEach(() => {
    clearApiCache()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetchMapPoints sends the full LGU name, not a stripped token', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => [] })
    await fetchMapPoints(500, 'Cebu City')
    const [url] = fetch.mock.calls[0]
    // Full name must be present (URL-encoded space), never the bare "Cebu".
    expect(url).toContain('municipality=Cebu+City')
    expect(url).not.toMatch(/municipality=Cebu(&|$)/)
  })

  it('fetchMapPoints preserves "City of X" style names verbatim', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => [] })
    await fetchMapPoints(500, 'City of Bogo')
    const [url] = fetch.mock.calls[0]
    expect(url).toContain('municipality=City+of+Bogo')
  })

  it('demonstrates why lguQuery must not feed the municipality param', () => {
    // lguQuery still exists for OSM/barangay boundary matching, but its output
    // would reintroduce the leak if used for the backend query.
    expect(lguQuery('Cebu City')).toBe('Cebu')
    expect(lguQuery('City of Bogo')).toBe('Bogo')
  })
})
