const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      Accept: 'application/json',
      ...(typeof options.body === 'string'
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...options.headers,
    },
  })
  let body
  try {
    body = await res.json()
  } catch {
    body = null
  }
  if (!res.ok) {
    const detail = body?.detail
    const error = new Error(
      typeof detail === 'string' ? detail : `Request failed (HTTP ${res.status})`,
    )
    error.status = res.status
    throw error
  }
  return body
}

export async function getOAuthUrl(provider, redirect = window.location.origin) {
  const data = await request(
    `/auth/oauth/${encodeURIComponent(provider)}?redirect=${encodeURIComponent(redirect)}`,
  )
  return data.url
}

export async function redirectToOAuth(provider) {
  const url = await getOAuthUrl(provider)
  window.location.assign(url)
}

export async function completeOAuthCallback({ accessToken, refreshToken }) {
  const data = await request('/auth/callback', {
    method: 'POST',
    body: JSON.stringify({
      access_token: accessToken,
      refresh_token: refreshToken,
    }),
  })
  return data.user
}

export async function getSession() {
  const data = await request('/auth/session')
  return data.user
}

export async function signInWithEmail(email, password) {
  const data = await request('/auth/signin', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  return data.user
}

export async function signUpWithEmail(
  email,
  password,
  redirect = window.location.origin,
) {
  return request('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, redirect }),
  })
}

export async function resendConfirmationEmail(
  email,
  redirect = window.location.origin,
) {
  return request('/auth/resend', {
    method: 'POST',
    body: JSON.stringify({ email, redirect }),
  })
}

export async function signOut() {
  await request('/auth/signout', { method: 'POST' })
}
