import { useState } from 'react'
import Layout from '../layout/Layout'

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

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        fill="#1877F2"
        d="M24 12c0-6.6-5.4-12-12-12S0 5.4 0 12c0 6 4.4 11 10.1 11.9v-8.4H7.1V12h3v-2.6c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.3l-.5 3.5h-2.8v8.4C19.6 23 24 18 24 12z"
      />
    </svg>
  )
}

function SignInPage() {
  const [status, setStatus] = useState(null)

  function signIn(provider) {
    setStatus(
      `${provider} sign-in is not connected yet — add your ${provider} OAuth credentials to enable it.`,
    )
  }

  return (
    <Layout>
      <section>
        <div className="mx-auto max-w-md px-6 py-16">
          <h1 className="font-serif text-3xl text-gray-a12">Sign in</h1>
          <p className="mt-2 text-sm text-gray-a11">
            Access ProjectTRACK with your Facebook or Google account.
          </p>

          <div className="mt-8 space-y-3">
            <button
              type="button"
              onClick={() => signIn('Google')}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-a6 bg-white px-6 py-3 text-sm font-semibold text-gray-a12 transition hover:bg-gray-a2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f3d3c]"
            >
              <GoogleIcon />
              Continue with Google
            </button>
            <button
              type="button"
              onClick={() => signIn('Facebook')}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-a6 bg-white px-6 py-3 text-sm font-semibold text-gray-a12 transition hover:bg-gray-a2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f3d3c]"
            >
              <FacebookIcon />
              Continue with Facebook
            </button>
          </div>

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
    </Layout>
  )
}

export default SignInPage
