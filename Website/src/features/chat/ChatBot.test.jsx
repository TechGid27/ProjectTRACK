import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChatBot from './ChatBot'

function sseChunks(chunks) {
  let index = 0
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: async () => {
          if (index >= chunks.length) return { done: true, value: undefined }
          return {
            done: false,
            value: new TextEncoder().encode(chunks[index++]),
          }
        },
      }),
    },
  }
}

function frame(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

describe('ChatBot', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('starts closed and opens the chat panel from the floating button', async () => {
    const user = userEvent.setup()
    render(<ChatBot />)
    expect(
      screen.queryByRole('dialog', { name: /chat assistant/i }),
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: /open chat assistant/i }),
    )
    expect(
      screen.getByRole('dialog', { name: /chat assistant/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/DPWH Cebu infrastructure only/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /top contractors in cebu/i }),
    ).toBeInTheDocument()
  })

  it('streams GraphRAG tokens into the assistant bubble', async () => {
    const user = userEvent.setup()
    fetch.mockResolvedValue(
      sseChunks([
        frame('context', { matched_projects_count: 1 }),
        frame('token', { token: 'Mandaue ' }),
        frame('token', { token: 'flood control leader.' }),
        frame('done', { status: 'completed' }),
      ]),
    )
    render(<ChatBot />)
    await user.click(
      screen.getByRole('button', { name: /open chat assistant/i }),
    )
    await user.type(
      screen.getByRole('textbox', { name: /chat message/i }),
      'Top contractor in Mandaue?{Enter}',
    )

    await waitFor(() => {
      expect(screen.getByText(/Mandaue flood control leader\./)).toBeInTheDocument()
    })
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/chat/stream'),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('surfaces guardrail rejection messages', async () => {
    const user = userEvent.setup()
    fetch.mockResolvedValue(
      sseChunks([
        frame('guardrail', {
          reason: 'programming_intent',
          message: 'Out of Scope: Programming and software code generation queries are outside system scope.',
        }),
        frame('done', { status: 'blocked' }),
      ]),
    )
    render(<ChatBot />)
    await user.click(
      screen.getByRole('button', { name: /open chat assistant/i }),
    )
    await user.type(
      screen.getByRole('textbox', { name: /chat message/i }),
      'Write me a python script{Enter}',
    )

    await waitFor(() => {
      expect(screen.getByText(/Out of Scope: Programming/)).toBeInTheDocument()
    })
  })

  it('shows a friendly error when the backend is unreachable', async () => {
    const user = userEvent.setup()
    fetch.mockRejectedValue(new Error('network down'))
    render(<ChatBot />)
    await user.click(
      screen.getByRole('button', { name: /open chat assistant/i }),
    )
    await user.type(
      screen.getByRole('textbox', { name: /chat message/i }),
      'Any projects in Bogo?{Enter}',
    )

    await waitFor(() => {
      expect(
        screen.getByText(/Could not reach the ProjectTRACK backend/),
      ).toBeInTheDocument()
    })
  })

  it('maps HTTP 429 to a rate-limit message', async () => {
    const user = userEvent.setup()
    fetch.mockResolvedValue({ ok: false, status: 429 })
    render(<ChatBot />)
    await user.click(
      screen.getByRole('button', { name: /open chat assistant/i }),
    )
    await user.type(
      screen.getByRole('textbox', { name: /chat message/i }),
      'Any projects in Bogo?{Enter}',
    )

    await waitFor(() => {
      expect(screen.getByText(/Rate limit reached/)).toBeInTheDocument()
    })
  })
})
