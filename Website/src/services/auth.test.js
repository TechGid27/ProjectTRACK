import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { completeOAuthCallback, getSession, signInWithEmail } from './auth'

describe('auth service (backend proxy)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('getSession fetches the cookie session from the backend', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ user: { id: 'u1', email: 'a@b.c' } }),
    })
    const user = await getSession()
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/auth/session',
      expect.objectContaining({ credentials: 'include' }),
    )
    expect(user).toEqual({ id: 'u1', email: 'a@b.c' })
  })

  it('getSession returns null when nobody is signed in', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ user: null }),
    })
    await expect(getSession()).resolves.toBeNull()
  })

  it('completeOAuthCallback exchanges fragment tokens for cookies', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ user: { id: 'u1' } }),
    })
    const user = await completeOAuthCallback({
      accessToken: 'tok',
      refreshToken: 'ref',
    })
    const [url, options] = fetch.mock.calls[0]
    expect(url).toContain('/api/auth/callback')
    expect(options.method).toBe('POST')
    expect(options.body).toBe(
      JSON.stringify({ access_token: 'tok', refresh_token: 'ref' }),
    )
    expect(user).toEqual({ id: 'u1' })
  })

  it('signInWithEmail throws the backend error detail on failure', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Invalid login credentials.' }),
    })
    await expect(
      signInWithEmail('a@b.c', 'wrong-password'),
    ).rejects.toThrow('Invalid login credentials.')
  })

  it('fails with a generic message when the backend returns a non-string detail', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ detail: [{ msg: 'field required' }] }),
    })
    await expect(getSession()).rejects.toThrow(/HTTP 422/)
  })

  it('handles responses without a JSON body', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('not json')
      },
    })
    await expect(getSession()).rejects.toThrow(/HTTP 502/)
  })
})
