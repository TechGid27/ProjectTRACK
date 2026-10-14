import { useEffect, useState } from 'react'
import HomePage from '../pages/HomePage'
import SignInPage from '../pages/SignInPage'

function getRoute() {
  return window.location.hash.replace(/^#/, '') || '/'
}

function App() {
  const [route, setRoute] = useState(getRoute)

  useEffect(() => {
    function onHashChange() {
      setRoute(getRoute())
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  if (route === '/signin') return <SignInPage />
  return <HomePage />
}

export default App
