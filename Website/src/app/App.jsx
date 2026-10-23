import { lazy, Suspense, useEffect, useState } from 'react'
import HomePage from '../pages/HomePage'
import SignInPage from '../pages/Auth/SignInPage'
import SignUpPage from '../pages/Auth/SignUpPage'
import Layout from '../layout/Layout'
import { navLinks, site } from '../data/site'
import { completeOAuthCallback } from '../services/auth'
import { navigate, useRoute } from './router'

const ContractorRankingPage = lazy(() => import('../pages/ContractorRankingPage'))

// Supabase returns an OAuth/confirmation response in the fragment
// (#access_token=... implicit flow), as an auth code (?code=... PKCE), or as an
// error in either place. Read all of them so a failed sign-in is reported
// instead of silently dropping the user on the home page signed out.
function readAuthRedirect() {
  const query = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.slice(1))
  const pick = (key) => query.get(key) ?? hash.get(key)
  return {
    accessToken: hash.get('access_token'),
    refreshToken: hash.get('refresh_token'),
    code: pick('code'),
    error: pick('error_description') ?? pick('error_code') ?? pick('error'),
  }
}

function App() {
  const route = useRoute()
  const [initialRedirect] = useState(readAuthRedirect)
  const [authPending, setAuthPending] = useState(
    () => Boolean(initialRedirect.accessToken || initialRedirect.code) && !initialRedirect.error,
  )
  const [authError, setAuthError] = useState(
    initialRedirect.error ? `Sign-in failed: ${initialRedirect.error}` : null,
  )

  useEffect(() => {
    const { accessToken, refreshToken, code, error } = readAuthRedirect()
    if (!accessToken && !code && !error) return undefined

    const finish = () => {
      window.history.replaceState(null, '', window.location.pathname)
      setAuthPending(false)
    }

    // The error is already surfaced from the initial state; just clean the URL.
    if (error) {
      finish()
      return undefined
    }

    const exchange = accessToken
      ? completeOAuthCallback({ accessToken, refreshToken })
      : // GoTrue only issues an auth code when a PKCE code_challenge was sent,
        // which this client does not do — fail loudly rather than sign nobody in.
        Promise.reject(
          new Error(
            'received an authorization code (?code) that this build cannot exchange',
          ),
        )

    exchange
      .catch((err) => {
        setAuthError(`Sign-in failed: ${err?.message || 'unexpected error'}`)
      })
      .finally(finish)
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

  let page
  if (route === '/signin') {
    page = <SignInPage />
  } else if (route === '/signup') {
    page = <SignUpPage />
  } else if (route === '/contractors') {
    page = (
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
  } else {
    page = <HomePage />
  }

  const content = (
    <Layout name={site.name} links={navLinks}>
      {page}
    </Layout>
  )

  if (!authError) return content
  return (
    <>
      <p
        role="alert"
        className="fixed left-1/2 top-4 z-50 w-[min(92vw,36rem)] -translate-x-1/2 rounded-xl border border-red-400 bg-white px-4 py-3 text-sm font-medium text-red-500 shadow-lg"
      >
        {authError}
        <button
          type="button"
          onClick={() => setAuthError(null)}
          className="ml-3 font-semibold underline underline-offset-2"
        >
          Dismiss
        </button>
      </p>
      {content}
    </>
  )
}

export default App
