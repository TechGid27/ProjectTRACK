import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SignInPage from './SignInPage'

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

describe('SignInPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.getSession.mockResolvedValue(null)
  })

  it('renders the heading, both OAuth buttons, and the email form', () => {
    render(<SignInPage />)
    expect(
      screen.getByRole('heading', { name: /sign in/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /continue with google/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /continue with facebook/i }),
    ).toBeInTheDocument()
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
      screen.getByRole('button', { name: /continue with facebook/i }),
    )
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        /facebook sign-in failed/i,
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
      expect(
        screen.getByText(/watchdog@example\.com/),
      ).toBeInTheDocument()
    })
    expect(
      screen.getByRole('button', { name: /sign out/i }),
    ).toBeInTheDocument()
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
    ).toHaveAttribute('href', '#/signup')
  })

  it('shows the signed-in session on mount and signs out', async () => {
    authMock.getSession.mockResolvedValue({
      id: 'user-9',
      email: 'watchdog@example.com',
    })
    render(<SignInPage />)
    await waitFor(() => {
      expect(
        screen.getByText(/watchdog@example\.com/),
      ).toBeInTheDocument()
    })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /sign out/i }))
    expect(authMock.signOut).toHaveBeenCalled()
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /sign in with email/i }),
      ).toBeInTheDocument()
    })
  })
})
