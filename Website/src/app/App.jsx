import { lazy, Suspense, useEffect, useState } from 'react'
import HomePage from '../pages/HomePage'
import SignInPage from '../pages/Auth/SignInPage'
import SignUpPage from '../pages/Auth/SignUpPage'
import { completeOAuthCallback } from '../services/auth'
import { navigate, useRoute } from './router'

const ContractorRankingPage = lazy(() => import('../pages/ContractorRankingPage'))

function App() {
  const route = useRoute()
  const [authPending, setAuthPending] = useState(() =>
    window.location.hash.includes('access_token='),
  )

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (!hash.includes('access_token=')) return undefined
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    completeOAuthCallback({ accessToken, refreshToken })
      .catch(() => {})
      .finally(() => {
        window.history.replaceState(null, '', '/')
        setAuthPending(false)
      })
    return undefined
  }, [])

  const known =
    route === '/' ||
    route === '' ||
    route === 'municipalities' ||
    route === '/signin' ||
    route === '/signup' ||
    route === '/contractors'

  useEffect(() => {
    if (!known) navigate('/', { replace: true })
  }, [known])

  if (authPending) {
    return (
      <p role="status" className="p-8 text-center text-sm text-gray-a11">
        Completing sign-in…
      </p>
    )
  }
  if (route === '/signin') return <SignInPage />
  if (route === '/signup') return <SignUpPage />
  if (route === '/contractors') {
    return (
      <Suspense
        fallback={
          <p role="status" className="p-8 text-center text-sm text-gray-a11">
            Loading rankings…
          </p>
        }
      >
        <ContractorRankingPage />
      </Suspense>
    )
  }
  return <HomePage />
}

export default App
