import { useEffect, useRef, useState } from 'react'
import { streamChatMessage } from '../../services/api'

const SUGGESTIONS = [
  'Which contractor got the biggest flood control budget in Bogo?',
  'Tell me about project 24HH0043',
  'Top contractors in Cebu?',
]

const FALLBACK_ERRORS = {
  404: 'Chat endpoint not available on the backend — try again after restarting it.',
  429: 'Rate limit reached — wait a minute before asking again.',
  503: 'Chat service is temporarily unavailable.',
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 12a8 8 0 0 1-8 8H5l-2 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 11h.01M12 11h.01M16 11h.01" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChatBot() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [messages, setMessages] = useState([])
  const listRef = useRef(null)
  const idRef = useRef(0)

  useEffect(() => {
    const node = listRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages, open])

  function errorMessage(error) {
    if (error && FALLBACK_ERRORS[error.status]) return FALLBACK_ERRORS[error.status]
    return 'Could not reach the ProjectTRACK backend — is it running?'
  }

  async function send(text) {
    const value = (text ?? '').trim()
    if (!value || sending) return
    setInput('')
    setSending(true)

    const history = messages
      .filter((m) => m.text)
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.text }))

    idRef.current += 1
    const replyId = `r${idRef.current}`
    setMessages((prev) => [
      ...prev,
      { id: `u${idRef.current}`, role: 'user', text: value },
      { id: replyId, role: 'assistant', text: '', streaming: true },
    ])

    const patchReply = (patch) =>
      setMessages((prev) =>
        prev.map((m) => (m.id === replyId ? { ...m, ...patch } : m)),
      )

    try {
      await streamChatMessage({
        message: value,
        history,
        onEvent(event, payload) {
          if (event === 'token') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === replyId ? { ...m, text: m.text + payload.token } : m,
              ),
            )
          } else if (event === 'guardrail') {
            patchReply({ text: payload.message, streaming: false })
          } else if (event === 'done') {
            patchReply({ streaming: false })
          }
        },
      })
      setMessages((prev) =>
        prev.map((m) =>
          m.id === replyId && !m.text
            ? { ...m, text: 'No response received.', streaming: false }
            : m.streaming
              ? { ...m, streaming: false }
              : m,
        ),
      )
    } catch (error) {
      patchReply({ text: errorMessage(error), streaming: false })
    } finally {
      setSending(false)
    }
  }

  function onSubmit(event) {
    event.preventDefault()
    send(input)
  }

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="ProjectTRACK AI chat assistant"
          className="fixed bottom-20 right-4 z-[1500] flex h-[min(70vh,520px)] w-[min(92vw,360px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c1418]/95 shadow-2xl backdrop-blur-md"
        >
          <div className="flex items-center justify-between border-b border-white/10 bg-[#1f3d3c]/40 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-white">ProjectTRACK Watchdog</p>
              <p className="text-[10px] text-emerald-300/80">
                GraphRAG · DPWH Cebu infrastructure only
              </p>
            </div>
            <button
              type="button"
              aria-label="Close chat"
              onClick={() => setOpen(false)}
              className="grid h-7 w-7 place-items-center rounded-md text-white/50 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-[12px] leading-relaxed text-white/60">
                  Ask about DPWH Cebu projects, contractors, budgets, or
                  locations. Non-infrastructure questions are rejected by
                  guardrails.
                </p>
                <div className="space-y-1.5">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => send(suggestion)}
                      disabled={sending}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-[11px] leading-snug text-white/75 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 disabled:opacity-50"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[12px] leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-[#1f3d3c] text-white'
                      : 'border border-white/10 bg-white/5 text-white/85'
                  }`}
                >
                  {m.text || (m.streaming ? '…' : '')}
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={onSubmit}
            className="flex items-center gap-2 border-t border-white/10 px-3 py-3"
          >
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about DPWH Cebu projects…"
              aria-label="Chat message"
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white placeholder:text-white/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send message"
              className="rounded-lg bg-[#2a5452] px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-[#356a67] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400/70 disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        aria-label={open ? 'Hide chat assistant' : 'Open chat assistant'}
        onClick={() => setOpen((prev) => !prev)}
        className="fixed bottom-4 right-4 z-[1500] grid h-12 w-12 place-items-center rounded-full bg-[#1f3d3c] text-emerald-300 shadow-xl ring-1 ring-emerald-400/40 transition hover:bg-[#2a5452] hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400/70"
      >
        <ChatIcon />
      </button>
    </>
  )
}

export default ChatBot
