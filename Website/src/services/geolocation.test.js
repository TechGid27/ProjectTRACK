import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  captureGeolocation,
  captureGeolocationDetailed,
  geolocationFailureMessage,
} from './geolocation'

// Build a getCurrentPosition mock from a queue of outcomes. Each call consumes
// the next outcome: { coords } => success, { code } => error.
function mockGeolocation(outcomes) {
  const queue = [...outcomes]
  return vi.fn((success, error) => {
    const next = queue.shift()
    if (next && 'coords' in next) {
      success({ coords: next.coords })
    } else {
      error({ code: next?.code ?? 2, message: next?.message ?? 'err' })
    }
  })
}

describe('captureGeolocation / captureGeolocationDetailed', () => {
  beforeEach(() => {
    // Secure context by default so the guard does not short-circuit.
    vi.stubGlobal('window', { isSecureContext: true })
    vi.stubGlobal('navigator', {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('resolves coordinates on a first-pass (high-accuracy) success', async () => {
    const getCurrentPosition = mockGeolocation([
      { coords: { latitude: 10.3283, longitude: 123.9286, accuracy: 5 } },
    ])
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })

    await expect(captureGeolocation()).resolves.toEqual({
      latitude: 10.3283,
      longitude: 123.9286,
    })
    // First call requests high accuracy.
    expect(getCurrentPosition.mock.calls[0][2]).toEqual(
      expect.objectContaining({ enableHighAccuracy: true }),
    )
  })

  it('falls back to a coarse second pass when high-accuracy times out', async () => {
    const getCurrentPosition = mockGeolocation([
      { code: 3, message: 'Timeout expired' }, // high-accuracy pass fails
      { coords: { latitude: 10.5, longitude: 123.9 } }, // coarse pass succeeds
    ])
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })

    const result = await captureGeolocationDetailed()
    expect(result).toEqual(
      expect.objectContaining({ ok: true, latitude: 10.5, longitude: 123.9 }),
    )
    expect(getCurrentPosition).toHaveBeenCalledTimes(2)
    // Second pass drops high accuracy and tolerates a cached fix.
    expect(getCurrentPosition.mock.calls[1][2]).toEqual(
      expect.objectContaining({ enableHighAccuracy: false, maximumAge: 60000 }),
    )
  })

  it('reports reason "timeout" when both passes time out', async () => {
    const getCurrentPosition = mockGeolocation([
      { code: 3 },
      { code: 3 },
    ])
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })

    const result = await captureGeolocationDetailed()
    expect(result).toEqual({ ok: false, reason: 'timeout' })
    await expect(captureGeolocation()).resolves.toBeNull()
  })

  it('does NOT retry on permission denial and reports "denied"', async () => {
    const getCurrentPosition = mockGeolocation([{ code: 1 }, { code: 1 }])
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })

    const result = await captureGeolocationDetailed()
    expect(result).toEqual({ ok: false, reason: 'denied' })
    expect(getCurrentPosition).toHaveBeenCalledTimes(1) // no second pass
  })

  it('reports "insecure_context" on a non-secure origin without calling the API', async () => {
    const getCurrentPosition = vi.fn()
    vi.stubGlobal('window', { isSecureContext: false })
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })

    const result = await captureGeolocationDetailed()
    expect(result).toEqual({ ok: false, reason: 'insecure_context' })
    expect(getCurrentPosition).not.toHaveBeenCalled()
  })

  it('reports "unsupported" when geolocation is unavailable', async () => {
    vi.stubGlobal('window', { isSecureContext: true })
    vi.stubGlobal('navigator', {})
    const result = await captureGeolocationDetailed()
    expect(result).toEqual({ ok: false, reason: 'unsupported' })
  })

  it('reports "invalid" when coordinates are not finite in both passes', async () => {
    const getCurrentPosition = mockGeolocation([
      { coords: { latitude: NaN, longitude: NaN } },
      { coords: { latitude: NaN, longitude: NaN } },
    ])
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })
    const result = await captureGeolocationDetailed()
    expect(result).toEqual({ ok: false, reason: 'invalid' })
  })
})

describe('geolocationFailureMessage', () => {
  it('returns actionable copy for each reason', () => {
    expect(geolocationFailureMessage('insecure_context')).toMatch(/HTTPS|localhost/i)
    expect(geolocationFailureMessage('denied')).toMatch(/permission/i)
    expect(geolocationFailureMessage('timeout')).toMatch(/location/i)
    expect(geolocationFailureMessage('unavailable')).toMatch(/location/i)
    expect(geolocationFailureMessage('unsupported')).toMatch(/geolocation/i)
    expect(geolocationFailureMessage('invalid')).toMatch(/retry/i)
  })
})
