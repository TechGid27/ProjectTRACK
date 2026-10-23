import { useEffect, useRef, useState } from 'react'
import { getSession, signOut } from '../services/auth'
import { useRoute, navigate } from '../app/router'
import { applyTheme, getInitialTheme, toggleTheme } from '../services/theme'

function normalize(href) {
  const path = href.replace(/^#/, '')
  return path === '' || path === 'municipalities' ? '/' : path
}

// Tri-colour brand wordmark: the leading "P" and "Project" track the logo tone
// (black in light mode, white in dark mode) while "Track" is always green.
function Wordmark() {
  return (
    <span className="text-base font-bold tracking-tight">
      <span className="text-gray-a12">Project</span>
      <span className="text-emerald-500">Track</span>
    </span>
  )
}

function ThemeToggle({ theme, onToggle, className = '' }) {
  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-a11 transition hover:bg-gray-a3 hover:text-gray-a12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f3d3c] ${className}`}
    >
      {isDark ? (
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <circle cx="10" cy="10" r="4" />
          <path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4 4l1.4 1.4M14.6 14.6L16 16M16 4l-1.4 1.4M5.4 14.6L4 16" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M16.5 11.5A6.5 6.5 0 018.5 3.5a6.5 6.5 0 108 8z" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}

function NavLink({ link, active, isSignIn, onNavigate }) {
  return (
    <a
      href={link.href}
      aria-current={active ? 'page' : undefined}
      onClick={(event) => {
        event.preventDefault()
        navigate(link.href)
        onNavigate?.()
      }}
      className={
        isSignIn
          ? `block rounded-xl px-4 py-2 text-center text-sm font-semibold no-underline transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f3d3c] ${
              active
                ? 'bg-[#1f3d3c] text-white'
                : 'bg-[#1f3d3c]/10 text-[#1f3d3c] hover:bg-[#1f3d3c]/15'
            }`
          : `block rounded-lg px-3 py-2 text-center text-sm no-underline transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f3d3c] ${
              active
                ? 'font-semibold text-gray-a12'
                : 'text-gray-a11 hover:text-gray-a12'
            }`
      }
    >
      {link.label}
    </a>
  )
}

function Header({ name, links }) {
  const route = useRoute()
  const [user, setUser] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [theme, setTheme] = useState(getInitialTheme)
  const menuRef = useRef(null)
  const mobileRef = useRef(null)
  const mobileToggleRef = useRef(null)

  function handleToggleTheme() {
    setTheme((current) => toggleTheme(current))
  }

  // Keep the attribute in sync if the component mounts after a route change.
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    let cancelled = false
    getSession()
      .then((u) => {
        if (!cancelled) setUser(u)
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!menuOpen) return undefined
    function onClick(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuOpen])

  useEffect(() => {
    if (!mobileOpen) return undefined
    function onClick(event) {
      // The hamburger button toggles `mobileOpen` itself. Without this guard the
      // document mousedown listener would close the menu first, then the
      // button's onClick would reopen it — so a second tap appeared to do
      // nothing. Ignore clicks that land on the toggle button.
      if (mobileToggleRef.current && mobileToggleRef.current.contains(event.target)) {
        return
      }
      if (mobileRef.current && !mobileRef.current.contains(event.target)) {
        setMobileOpen(false)
      }
    }
    function onKey(event) {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [mobileOpen])

  const [prevRoute, setPrevRoute] = useState(route)
  if (route !== prevRoute) {
    setPrevRoute(route)
    if (mobileOpen) setMobileOpen(false)
  }

  async function handleSignOut() {
    try {
      await signOut()
    } catch {
      // ignore — clear local state regardless
    }
    setUser(null)
    setMenuOpen(false)
    setMobileOpen(false)
    navigate('/signin')
  }

  const email = user?.email ?? ''
  const initial = email ? email.charAt(0).toUpperCase() : '?'
  const visibleLinks = links.filter(
    (link) => !(normalize(link.href) === '/signin' && user),
  )

  return (
    <header
      className="sticky top-0 z-[5000] border-b border-gray-a5 backdrop-blur-md"
      style={{ backgroundColor: 'var(--app-surface-alpha)' }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <a
          href="/"
          className="flex shrink-0 items-center gap-2.5 text-inherit no-underline"
        >
          <img
            src={theme === 'dark' ? '/image/BlackP.png' : '/image/reyalopake.png'}
            alt={`${name} logo`}
            className="h-10 w-10 object-contain"
          />
          <Wordmark />
        </a>

        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-1.5">
            {visibleLinks.map((link) => {
              const active = normalize(link.href) === route
              const isSignIn = normalize(link.href) === '/signin'
              return (
                <li key={link.href}>
                  <NavLink
                    link={link}
                    active={active}
                    isSignIn={isSignIn}
                  />
                </li>
              )
            })}
            <li>
              <ThemeToggle theme={theme} onToggle={handleToggleTheme} />
            </li>
            {user && (
              <li className="relative" ref={menuRef}>
                <button
                  type="button"
                  aria-label="Account menu"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((open) => !open)}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-[#1f3d3c] bg-[#1f3d3c] text-sm font-bold text-white transition hover:bg-[#2a5452] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f3d3c]"
                >
                  {initial}
                </button>
                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-[1001] mt-2 w-56 overflow-hidden rounded-xl border border-gray-a5 shadow-lg"
                    style={{ backgroundColor: 'var(--app-surface)' }}
                  >
                    <div className="border-b border-gray-a5 px-4 py-3">
                      <p className="truncate text-sm font-semibold text-gray-a12">
                        {email}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleSignOut}
                      className="w-full cursor-pointer px-4 py-2.5 text-left text-sm text-red-a11 transition hover:bg-red-a3 hover:text-red-a12 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-red-a8"
                    >
                      Log out
                    </button>
                  </div>
                )}
              </li>
            )}
          </ul>
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle theme={theme} onToggle={handleToggleTheme} />
          <button
            ref={mobileToggleRef}
            type="button"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-a12 transition hover:bg-gray-a3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f3d3c]"
          >
            {mobileOpen ? (
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M3 6h14M3 10h14M3 14h14" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav
          ref={mobileRef}
          aria-label="Mobile"
          className="border-t border-gray-a5 px-4 py-3 md:hidden"
          style={{ backgroundColor: 'var(--app-surface)' }}
        >
          <ul className="flex flex-col gap-1">
            {visibleLinks.map((link) => {
              const active = normalize(link.href) === route
              const isSignIn = normalize(link.href) === '/signin'
              return (
                <li key={link.href}>
                  <NavLink
                    link={link}
                    active={active}
                    isSignIn={isSignIn}
                    onNavigate={() => setMobileOpen(false)}
                  />
                </li>
              )
            })}
          </ul>
          {user && (
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-a5 pt-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-[#1f3d3c] bg-[#1f3d3c] text-sm font-bold text-white">
                  {initial}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-a12">
                    {user?.user_metadata?.full_name || email}
                  </p>
                  <p className="truncate text-xs text-gray-a10">{email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="shrink-0 cursor-pointer rounded-lg bg-red-a3 px-3 py-1.5 text-xs font-semibold text-red-a11 transition hover:bg-red-a4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-a8"
              >
                Log out
              </button>
            </div>
          )}
        </nav>
      )}
    </header>
  )
}

export default Header
