import { useEffect, useState } from 'react'
import {
  getSession,
  redirectToOAuth,
  signInWithEmail,
  signOut,
} from '../../services/auth'
import { navigate } from '../../app/router'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.1 3.7-8.6z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-6-2.1-6.9-5.1L1.2 17C3.2 21.2 7.3 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.1 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3L1.2 6.7C.4 8.3 0 10.1 0 12s.4 3.7 1.2 5.3l3.9-3z"
      />
      <path
        fill="#EA4335"
        d="M12 4.8c2.3 0 3.8 1 4.7 1.8l3.5-3.4C18 1.2 15.2 0 12 0 7.3 0 3.2 2.8 1.2 6.7l3.9 3c.9-2.9 3.7-4.9 6.9-4.9z"
      />
    </svg>
  )
}

function SignInPage() {
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(null)
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    let cancelled = false
    getSession()
      .then((user) => {
        if (cancelled) return
        if (user) {
          navigate('/', { replace: true })
          return
        }
        setSession(user)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  async function signIn(provider) {
    const label = provider.charAt(0).toUpperCase() + provider.slice(1)
    setBusy(provider)
    setStatus(null)
    try {
      await redirectToOAuth(provider)
      setStatus(`Redirecting to ${label}…`)
    } catch (error) {
      setStatus(`${label} sign-in failed: ${error.message}`)
    } finally {
      setBusy(null)
    }
  }

  async function handleEmailSubmit(event) {
    event.preventDefault()
    setBusy('email')
    setStatus(null)

    try {
      const user = await signInWithEmail(email, password)

      if (user) {
        navigate('/', { replace: true })
      } else {
        setStatus('Login successful, but no user data was returned.')
      }
    } catch (error) {
      setStatus(error.message)
    } finally {
      setBusy(null)
    }
  }

  async function handleSignOut() {
    try {
      await signOut()
      setSession(null)
      setStatus('Signed out.')
    } catch (error) {
      setStatus(`Sign-out failed: ${error.message}`)
    }
  }

  const accountEmail = session?.email ?? session?.id ?? 'your account'

  return (
    <section>
      <div className="mx-auto max-w-md px-6 py-16">
        <h1 className="font-serif text-3xl text-gray-a12">Sign in</h1>
          <p className="mt-2 text-sm text-gray-a11">
            Access ProjectTRACK with your Google account, or with your email
            and password.
          </p>

          {session ? (
            <div className="mt-8 space-y-3">
              <p className="rounded-xl border border-emerald-600/30 bg-emerald-600/10 px-4 py-3 text-sm text-emerald-700" style={{ color: 'var(--brand-accent-text)' }}>
                Signed in as <span className="font-semibold">{accountEmail}</span>
              </p>
              <button
                type="button"
                onClick={handleSignOut}
                style={{ backgroundColor: 'var(--app-surface)' }}
                className="w-full rounded-xl border border-gray-a6 px-6 py-3 text-sm font-semibold text-gray-a12 transition hover:bg-gray-a2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f3d3c]"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="mt-8 space-y-3">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => signIn('google')}
                style={{ backgroundColor: '#ffffff', color: '#1f2937' }}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-a6 px-6 py-3 text-sm font-semibold transition hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f3d3c] disabled:opacity-60"
              >
                <GoogleIcon />
                Continue with Google
              </button>

              <div className="relative py-2 text-center text-xs text-gray-a10">
                <span
                  className="relative z-10 px-3"
                  style={{ backgroundColor: 'var(--app-surface)' }}
                >
                  or with email
                </span>
                <span className="absolute inset-x-0 top-1/2 h-px bg-gray-a6" />
              </div>


              <form onSubmit={handleEmailSubmit} className="space-y-3">
                <label className="block">
                  <span className="text-xs font-semibold text-gray-a11">
                    Email
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    style={{ backgroundColor: 'var(--app-surface)' }}
                    className="mt-1 w-full rounded-xl border border-gray-a6 px-4 py-2.5 text-sm text-gray-a12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f3d3c]"
                    placeholder="you@example.com"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-gray-a11">
                    Password
                  </span>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    style={{ backgroundColor: 'var(--app-surface)' }}
                    className="mt-1 w-full rounded-xl border border-gray-a6 px-4 py-2.5 text-sm text-gray-a12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f3d3c]"
                    placeholder="••••••••"
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy !== null}
                  className="w-full rounded-xl bg-[#1f3d3c] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#16302f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f3d3c] disabled:opacity-60"
                >
                  Sign in with email
                </button>
              </form>

              <a
                href="/signup"
                className="block w-full text-center text-xs font-semibold text-[#1f3d3c] underline-offset-2 hover:underline"
              >
                New here? Create an account
              </a>
            </div>
          )}

          {status && (
            <p
              role="status"
              className="mt-6 rounded-xl border border-[#1f3d3c]/30 bg-[#1f3d3c]/5 px-4 py-3 text-sm text-[#1f3d3c]"
            >
              {status}
            </p>
          )}

          <p className="mt-8 text-center text-xs text-gray-a10">
            By continuing you agree to ProjectTRACK&apos;s terms and privacy
            policy.
          </p>
        </div>
      </section>
  )
}

export default SignInPage
