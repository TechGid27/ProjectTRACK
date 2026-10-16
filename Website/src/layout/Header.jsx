import { useEffect, useState } from 'react'

function useHash() {
  const [hash, setHash] = useState(
    () => window.location.hash.replace(/^#/, '') || '/',
  )

  useEffect(() => {
    function onHashChange() {
      setHash(window.location.hash.replace(/^#/, '') || '/')
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return hash
}

function normalize(href) {
  const path = href.replace(/^#/, '')
  return path === '' || path === 'municipalities' ? '/' : path
}

function Header({ name, links }) {
  const hash = useHash()

  return (
    <header className="sticky top-0 z-[1000] border-b border-gray-a5 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <a
          href="#/"
          className="flex items-center gap-2.5 text-inherit no-underline"
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
        <nav aria-label="Main">
          <ul className="flex items-center gap-1.5">
            {links.map((link) => {
              const active = normalize(link.href) === hash
              const isSignIn = normalize(link.href) === '/signin'
              return (
                <li key={link.href}>
                  <a
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={
                      isSignIn
                        ? `rounded-xl px-4 py-2 text-sm font-semibold no-underline transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f3d3c] ${
                            active
                              ? 'bg-[#1f3d3c] text-white'
                              : 'bg-[#1f3d3c]/10 text-[#1f3d3c] hover:bg-[#1f3d3c]/15'
                          }`
                        : `rounded-lg px-3 py-2 text-sm no-underline transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f3d3c] ${
                            active
                              ? 'font-semibold text-gray-a12'
                              : 'text-gray-a11 hover:text-gray-a12'
                          }`
                    }
                  >
                    {link.label}
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </header>
  )
}

export default Header
