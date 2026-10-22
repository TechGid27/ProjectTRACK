import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ChatCopilot from './ChatCopilot'

// Mock the map context so the copilot renders without a MapProvider.
vi.mock('../map/MapContext', () => ({
  useMapContext: () => ({
    setSpatialData: vi.fn(),
    highlightProject: vi.fn(),
    setSelectedProject: vi.fn(),
    projectDots: [],
  }),
}))

// Mock the streaming API.
const streamMock = vi.fn()
vi.mock('../../services/api', () => ({
  streamChatMessage: (...args) => streamMock(...args),
}))

describe('ChatCopilot', () => {
  beforeEach(() => {
    streamMock.mockReset()
  })

  function open() {
    render(<ChatCopilot />)
    fireEvent.click(screen.getByText(/Ask ProjectTRACK AI/i))
  }

  it('offers the "most reported" quick prompt', () => {
    open()
    expect(screen.getByText('📣 Most reported in Cebu')).toBeInTheDocument()
  })

  it('exposes the panel as a dialog for assistive tech', () => {
    open()
    expect(
      screen.getByRole('dialog', { name: /ProjectTRACK AI Copilot/i }),
    ).toBeInTheDocument()
  })

  it('shows a rate-limit error message on HTTP 429', async () => {
    streamMock.mockImplementation(async () => {
      const err = new Error('rate limited')
      err.status = 429
      throw err
    })
    open()
    fireEvent.click(screen.getByText('📣 Most reported in Cebu'))
    await waitFor(() =>
      expect(screen.getByText(/Rate limit reached/i)).toBeInTheDocument(),
    )
  })
})
