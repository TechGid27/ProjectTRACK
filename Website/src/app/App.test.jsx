import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import App from './App'

vi.mock('../pages/HomePage', () => ({
  default: () => <div data-testid="home-page">Home page</div>,
}))

const authMock = vi.hoisted(() => ({
  completeOAuthCallback: vi.fn(async () => ({ id: 'user-1' })),
  getSession: vi.fn(async () => null),
  redirectToOAuth: vi.fn(async () => {}),
  signInWithEmail: vi.fn(async () => null),
  signUpWithEmail: vi.fn(async () => ({ user: null, message: '' })),
  signOut: vi.fn(async () => {}),
}))

vi.mock('../services/auth', () => authMock)

describe('App pathname routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.getSession.mockResolvedValue(null)
    window.history.pushState({}, '', '/')
  })

  it('renders the home page by default', () => {
    render(<App />)
    expect(screen.getByTestId('home-page')).toBeInTheDocument()
  })

  it('renders the sign-in page on the /signin route', () => {
    window.history.pushState({}, '', '/signin')
    render(<App />)
    expect(
      screen.getByRole('heading', { name: /sign in/i }),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('home-page')).not.toBeInTheDocument()
  })

  it('renders the sign-up page on the /signup route', () => {
    window.history.pushState({}, '', '/signup')
    render(<App />)
    expect(
      screen.getByRole('heading', { name: /create account/i }),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('home-page')).not.toBeInTheDocument()
  })

  it('exchanges OAuth fragment tokens via the backend, then lands home', async () => {
    window.history.replaceState(
      null,
      '',
      '/#access_token=frag-token&refresh_token=frag-refresh&type=signup',
    )
    render(<App />)

    expect(screen.getByRole('status')).toHaveTextContent(
      /completing sign-in/i,
    )

    await waitFor(() => {
      expect(authMock.completeOAuthCallback).toHaveBeenCalledWith({
        accessToken: 'frag-token',
        refreshToken: 'frag-refresh',
      })
    })
    await waitFor(() => {
      expect(screen.getByTestId('home-page')).toBeInTheDocument()
    })
    expect(window.location.pathname).toBe('/')
    expect(window.location.hash).toBe('')
  })

  it('lands on home even when the token exchange fails', async () => {
    authMock.completeOAuthCallback.mockRejectedValueOnce(
      new Error('Invalid token'),
    )
    window.history.replaceState(
      null,
      '',
      '/#access_token=bad&refresh_token=bad',
    )
    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('home-page')).toBeInTheDocument()
    })
  })
})
