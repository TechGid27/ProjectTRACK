import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  THEME_STORAGE_KEY,
  applyTheme,
  getInitialTheme,
  toggleTheme,
} from './theme'

function setMatchMedia(matches) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

describe('theme helper', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses a stored choice over system preference', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    setMatchMedia(false) // system prefers light
    expect(getInitialTheme()).toBe('dark')
  })

  it('falls back to system preference when nothing is stored', () => {
    setMatchMedia(true) // system prefers dark
    expect(getInitialTheme()).toBe('dark')
    setMatchMedia(false)
    expect(getInitialTheme()).toBe('light')
  })

  it('applyTheme sets the data-theme attribute and persists', () => {
    applyTheme('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('applyTheme normalises unknown values to light', () => {
    expect(applyTheme('weird')).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('toggleTheme flips between light and dark', () => {
    expect(toggleTheme('light')).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(toggleTheme('dark')).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })
})
