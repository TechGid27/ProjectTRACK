import { useEffect, useRef, useState } from 'react'
import { getSession, signOut } from '../services/auth'
import { useRoute, navigate } from '../app/router'

function normalize(href) {
  const path = href.replace(/^#/, '')
  return path === '' || path === 'municipalities' ? '/' : path
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
  const menuRef = useRef(null)
  const mobileRef = useRef(null)

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
    <header className="sticky top-0 z-[5000] border-b border-gray-a5 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <a
          href="/"
          className="flex shrink-0 items-center gap-2.5 text-inherit no-underline"
        >
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1f3d3c] text-sm font-bold text-white"
          >
            {name.charAt(0)}
          </span>
          <span className="text-base font-bold tracking-tight text-gray-a12">
            {name}
          </span>
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
                    className="absolute right-0 top-full z-[1001] mt-2 w-56 overflow-hidden rounded-xl border border-gray-a5 bg-white shadow-lg"
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
          {user && (
            <div className="relative" ref={mobileRef}>
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
                  className="absolute right-0 top-full z-[1001] mt-2 w-56 overflow-hidden rounded-xl border border-gray-a5 bg-white shadow-lg"
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
            </div>
          )}
          <button
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
          aria-label="Mobile"
          className="border-t border-gray-a5 bg-white px-4 py-3 md:hidden"
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
        </nav>
      )}
    </header>
  )
}

export default Header
