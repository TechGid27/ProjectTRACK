import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Header from './Header'

const authMock = vi.hoisted(() => ({
  getSession: vi.fn(async () => null),
  signOut: vi.fn(async () => {}),
}))

vi.mock('../services/auth', () => authMock)

const links = [
  { label: 'Home', href: '/' },
  { label: 'Contractor Rankings', href: '/contractors' },
  { label: 'Sign In', href: '/signin' },
]

function setViewport(width) {
  window.innerWidth = width
  window.dispatchEvent(new Event('resize'))
}

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.getSession.mockResolvedValue(null)
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    window.history.pushState({}, '', '/')
    setViewport(375) // mobile
  })

  it('renders the tri-colour wordmark', () => {
    render(<Header name="ProjectTrack" links={links} />)
    expect(screen.getByText('Project')).toBeInTheDocument()
    expect(screen.getByText('Track')).toBeInTheDocument()
  })

  it('shows a "Get an App" button that falls back to the GitHub releases page when no APK URL is set', () => {
    render(<Header name="ProjectTrack" links={links} />)
    // Rendered in both the centered bar and the mobile menu; at least one exists.
    const btns = screen.getAllByTestId('get-app-btn')
    expect(btns.length).toBeGreaterThan(0)
    const href = btns[0].getAttribute('href')
    expect(href).toContain('github.com')
    expect(href).toContain('/releases')
    // Fallback opens in a new tab (not a direct download).
    expect(btns[0]).toHaveAttribute('target', '_blank')
  })

  it('mobile menu closes when the toggle is clicked again', async () => {
    const user = userEvent.setup()
    render(<Header name="ProjectTrack" links={links} />)

    const toggle = screen.getByRole('button', { name: /open menu/i })
    await user.click(toggle)
    // Menu open → a Mobile nav is present.
    expect(
      screen.getByRole('navigation', { name: /mobile/i }),
    ).toBeInTheDocument()

    // Re-click the same button must close it (regression: it used to reopen).
    const closeToggle = screen.getByRole('button', { name: /close menu/i })
    await user.click(closeToggle)
    await waitFor(() => {
      expect(
        screen.queryByRole('navigation', { name: /mobile/i }),
      ).not.toBeInTheDocument()
    })
  })

  it('theme toggle flips the data-theme attribute and persists', async () => {
    const user = userEvent.setup()
    render(<Header name="ProjectTrack" links={links} />)

    const toggle = screen.getAllByRole('button', {
      name: /switch to (dark|light) mode/i,
    })[0]
    await user.click(toggle)

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toMatch(
        /light|dark/,
      )
    })
    expect(window.localStorage.getItem('projecttrack-theme')).toMatch(
      /light|dark/,
    )
  })
})
