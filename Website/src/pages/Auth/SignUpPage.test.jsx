import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SignUpPage from './SignUpPage'

const authMock = vi.hoisted(() => ({
  redirectToOAuth: vi.fn(async () => {}),
  signUpWithEmail: vi.fn(async () => ({
    user: { id: 'user-2', email: 'new@example.com' },
    message: 'Account created — confirm your email, then sign in.',
  })),
}))

vi.mock('../../services/auth', () => authMock)

describe('SignUpPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the heading, OAuth buttons, and all three fields', () => {
    render(<SignUpPage />)
    expect(
      screen.getByRole('heading', { name: /create account/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /continue with google/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /continue with facebook/i }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/^email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(
      screen.getByLabelText(/confirm password/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /already have an account\? sign in/i }),
    ).toHaveAttribute('href', '#/signin')
  })

  it('creates an account through the backend and reports the message', async () => {
    const user = userEvent.setup()
    render(<SignUpPage />)
    await user.type(screen.getByLabelText(/^email/i), 'new@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'correct-horse')
    await user.type(
      screen.getByLabelText(/confirm password/i),
      'correct-horse',
    )
    await user.click(
      screen.getByRole('button', { name: /create account/i }),
    )
    expect(authMock.signUpWithEmail).toHaveBeenCalledWith(
      'new@example.com',
      'correct-horse',
    )
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        /confirm your email/i,
      )
    })
  })

  it('rejects submission when the passwords do not match', async () => {
    const user = userEvent.setup()
    render(<SignUpPage />)
    await user.type(screen.getByLabelText(/^email/i), 'new@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'correct-horse')
    await user.type(
      screen.getByLabelText(/confirm password/i),
      'different-pass',
    )
    await user.click(
      screen.getByRole('button', { name: /create account/i }),
    )
    expect(authMock.signUpWithEmail).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent(
      /passwords do not match/i,
    )
  })

  it('surfaces backend sign-up errors', async () => {
    authMock.signUpWithEmail.mockRejectedValueOnce(
      new Error('User already registered.'),
    )
    const user = userEvent.setup()
    render(<SignUpPage />)
    await user.type(screen.getByLabelText(/^email/i), 'taken@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'correct-horse')
    await user.type(
      screen.getByLabelText(/confirm password/i),
      'correct-horse',
    )
    await user.click(
      screen.getByRole('button', { name: /create account/i }),
    )
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        'User already registered.',
      )
    })
  })

  it('starts the Google OAuth redirect through the backend', async () => {
    const user = userEvent.setup()
    render(<SignUpPage />)
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
})
