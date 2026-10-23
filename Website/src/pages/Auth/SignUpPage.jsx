import { useState } from 'react'
import {
  redirectToOAuth,
  resendConfirmationEmail,
  signUpWithEmail,
} from '../../services/auth'

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

function SignUpPage() {
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  // Set once a signup is waiting on e-mail confirmation, so the user can retry
  // the send and see Supabase's actual delivery error instead of a silent miss.
  const [resendTo, setResendTo] = useState(null)

  async function signIn(provider) {
    const label = provider.charAt(0).toUpperCase() + provider.slice(1)
    setBusy(provider)
    setStatus(null)
    setResendTo(null)
    try {
      await redirectToOAuth(provider)
      setStatus(`Redirecting to ${label}…`)
    } catch (error) {
      setStatus(`${label} sign-up failed: ${error.message}`)
    } finally {
      setBusy(null)
    }
  }

  async function handleEmailSubmit(event) {
    event.preventDefault()
    if (password !== confirmPassword) {
      setStatus('Passwords do not match.')
      return
    }
    setBusy('email')
    setStatus(null)
    setResendTo(null)
    try {
      const result = await signUpWithEmail(email, password)
      setStatus(result.message || 'Check your email to confirm your account.')
      if (result.email_confirmation_required) setResendTo(email)
      // Keep the address in the field so the user can see where the link went.
      setPassword('')
      setConfirmPassword('')
    } catch (error) {
      setStatus(error.message)
    } finally {
      setBusy(null)
    }
  }

  async function handleResend() {
    setBusy('resend')
    setStatus(null)
    try {
      const result = await resendConfirmationEmail(resendTo)
      setStatus(result.message || `Confirmation email sent to ${resendTo}.`)
    } catch (error) {
      setStatus(`Could not resend the confirmation email: ${error.message}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section>
      <div className="mx-auto max-w-md px-6 py-16">
        <h1 className="font-serif text-3xl text-gray-a12">Create account</h1>
          <p className="mt-2 text-sm text-gray-a11">
            Join ProjectTRACK to track Cebu public works, file anomaly reports,
            and ask the GraphRAG assistant.
          </p>

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
                  className="mt-1 w-full rounded-xl border border-gray-a6 px-4 py-2.5 text-sm text-gray-a12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f3d3c]"
                  style={{ backgroundColor: 'var(--app-surface)' }}
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
                  className="mt-1 w-full rounded-xl border border-gray-a6 px-4 py-2.5 text-sm text-gray-a12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f3d3c]"
                  style={{ backgroundColor: 'var(--app-surface)' }}
                  placeholder="••••••••"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-gray-a11">
                  Confirm password
                </span>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-a6 px-4 py-2.5 text-sm text-gray-a12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f3d3c]"
                  style={{ backgroundColor: 'var(--app-surface)' }}
                  placeholder="••••••••"
                />
              </label>
              <button
                type="submit"
                disabled={busy !== null}
                className="w-full rounded-xl bg-[#1f3d3c] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#16302f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f3d3c] disabled:opacity-60"
              >
                Create account
              </button>
            </form>

            <a
              href="/signin"
              className="block w-full text-center text-xs font-semibold text-[#1f3d3c] underline-offset-2 hover:underline"
            >
              Already have an account? Sign in
            </a>
          </div>

          {status && (
            <p
              role="status"
              className="mt-6 rounded-xl border border-[#1f3d3c]/30 bg-[#1f3d3c]/5 px-4 py-3 text-sm text-[#1f3d3c]"
            >
              {status}
            </p>
          )}

          {resendTo && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={handleResend}
              style={{ backgroundColor: 'var(--app-surface)' }}
              className="mt-3 w-full rounded-xl border border-gray-a6 px-6 py-3 text-sm font-semibold text-gray-a12 transition hover:bg-gray-a2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f3d3c] disabled:opacity-60"
            >
              Resend confirmation email
            </button>
          )}

          <p className="mt-8 text-center text-xs text-gray-a10">
            By continuing you agree to ProjectTRACK&apos;s terms and privacy
            policy.
          </p>
        </div>
      </section>
  )
}

export default SignUpPage
