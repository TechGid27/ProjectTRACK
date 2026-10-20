import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SignInPage from './SignInPage'
import { navigate } from '../../app/router'

const authMock = vi.hoisted(() => ({
  getSession: vi.fn(async () => null),
  redirectToOAuth: vi.fn(async () => {}),
  signInWithEmail: vi.fn(async () => ({
    id: 'user-1',
    email: 'watchdog@example.com',
  })),
  signOut: vi.fn(async () => {}),
}))

vi.mock('../../services/auth', () => authMock)

vi.mock('../../app/router', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, navigate: vi.fn() }
})

describe('SignInPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.getSession.mockResolvedValue(null)
  })

  it('renders the heading, the Google OAuth button, and the email form', () => {
    render(<SignInPage />)
    expect(
      screen.getByRole('heading', { name: /sign in/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /continue with google/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /continue with facebook/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('starts the Google OAuth redirect through the backend', async () => {
    const user = userEvent.setup()
    render(<SignInPage />)
    await user.click(
      screen.getByRole('button', { name: /continue with google/i }),
    )
    expect(authMock.redirectToOAuth).toHaveBeenCalledWith('google')
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        /Redirecting to Google/,
      )
    })
  })

  it('shows the backend error when the OAuth redirect fails', async () => {
    const user = userEvent.setup()
    authMock.redirectToOAuth.mockRejectedValueOnce(
      new Error('Sign-in is not configured.'),
    )
    render(<SignInPage />)
    await user.click(
      screen.getByRole('button', { name: /continue with google/i }),
    )
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        /google sign-in failed/i,
      )
    })
  })

  it('signs in with email/password via the backend', async () => {
    const user = userEvent.setup()
    render(<SignInPage />)
    await user.type(screen.getByLabelText(/email/i), 'watchdog@example.com')
    await user.type(screen.getByLabelText(/password/i), 'correct-horse')
    await user.click(
      screen.getByRole('button', { name: /sign in with email/i }),
    )
    expect(authMock.signInWithEmail).toHaveBeenCalledWith(
      'watchdog@example.com',
      'correct-horse',
    )
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/', { replace: true })
    })
  })

  it('surfaces backend sign-in errors', async () => {
    const user = userEvent.setup()
    authMock.signInWithEmail.mockRejectedValueOnce(
      new Error('Invalid login credentials.'),
    )
    render(<SignInPage />)
    await user.type(screen.getByLabelText(/email/i), 'a@b.c')
    await user.type(screen.getByLabelText(/password/i), 'nope12')
    await user.click(
      screen.getByRole('button', { name: /sign in with email/i }),
    )
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        'Invalid login credentials.',
      )
    })
  })

  it('links to the create-account page', () => {
    render(<SignInPage />)
    expect(
      screen.getByRole('link', { name: /new here\? create an account/i }),
    ).toHaveAttribute('href', '/signup')
  })

  it('redirects to the home page when a session already exists', async () => {
    authMock.getSession.mockResolvedValue({
      id: 'user-9',
      email: 'watchdog@example.com',
    })
    render(<SignInPage />)
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/', { replace: true })
    })
    expect(
      screen.queryByRole('button', { name: /sign out/i }),
    ).not.toBeInTheDocument()
  })
})
