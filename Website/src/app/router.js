import { useEffect, useState } from 'react'

export function getRoute() {
  return window.location.pathname || '/'
}

export function navigate(to, { replace = false } = {}) {
  if (replace) window.history.replaceState(null, '', to)
  else window.history.pushState(null, '', to)
  window.dispatchEvent(new Event('popstate'))
}

export function useRoute() {
  const [route, setRoute] = useState(getRoute)

  useEffect(() => {
    function onPopState() {
      setRoute(getRoute())
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  return route
}
