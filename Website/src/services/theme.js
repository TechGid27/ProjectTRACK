// Light/dark theme helper.
//
// The resolved theme is applied as a `data-theme` attribute on the document's
// root element (`<html>`), which the dark colour scales in `index.css` key off
// of. The user's explicit choice is persisted to localStorage; when no choice
// has been made we fall back to the OS `prefers-color-scheme` setting.

export const THEME_STORAGE_KEY = 'projecttrack-theme'

/** @typedef {'light' | 'dark'} Theme */

function prefersDark() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

function readStored() {
  if (typeof window === 'undefined') return null
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

/**
 * Resolve the initial theme: an explicit stored choice wins, otherwise we
 * follow the system preference (defaulting to light).
 * @returns {Theme}
 */
export function getInitialTheme() {
  return readStored() ?? (prefersDark() ? 'dark' : 'light')
}

/**
 * Apply a theme to the document root and persist the choice.
 * @param {Theme} theme
 * @returns {Theme} the theme that was applied
 */
export function applyTheme(theme) {
  const next = theme === 'dark' ? 'dark' : 'light'
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', next)
  }
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, next)
  } catch {
    // storage unavailable — theme still applied for this session
  }
  return next
}

/**
 * Flip to the opposite theme, apply, and return the new value.
 * @param {Theme} current
 * @returns {Theme}
 */
export function toggleTheme(current) {
  return applyTheme(current === 'dark' ? 'light' : 'dark')
}
