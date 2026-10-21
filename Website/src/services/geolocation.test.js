import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { captureGeolocation } from './geolocation'

describe('captureGeolocation', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('resolves coordinates on success', async () => {
    const getCurrentPosition = vi.fn((success) =>
      success({
        coords: { latitude: 10.3283, longitude: 123.9286, accuracy: 5 },
      }),
    )
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })

    const result = await captureGeolocation()
    expect(result).toEqual({ latitude: 10.3283, longitude: 123.9286 })
    expect(getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({ enableHighAccuracy: true }),
    )
  })

  it('resolves null when permission is denied', async () => {
    const getCurrentPosition = vi.fn((_success, error) =>
      error({ code: 1, message: 'User denied Geolocation' }),
    )
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })

    await expect(captureGeolocation()).resolves.toBeNull()
  })

  it('resolves null when navigator.geolocation is unsupported', async () => {
    vi.stubGlobal('navigator', {})

    await expect(captureGeolocation()).resolves.toBeNull()
  })

  it('resolves null when coordinates are not finite numbers', async () => {
    const getCurrentPosition = vi.fn((success) =>
      success({ coords: { latitude: NaN, longitude: NaN } }),
    )
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })

    await expect(captureGeolocation()).resolves.toBeNull()
  })

  it('passes the custom timeout through to getCurrentPosition', async () => {
    const getCurrentPosition = vi.fn((success) =>
      success({ coords: { latitude: 1, longitude: 2 } }),
    )
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })

    await captureGeolocation(2500)
    expect(getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({ timeout: 2500 }),
    )
  })
})
