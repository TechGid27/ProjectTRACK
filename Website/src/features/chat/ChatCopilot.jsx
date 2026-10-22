import { useEffect, useRef, useState, useTransition } from 'react'
import { streamChatMessage } from '../../services/api'
import { useMapContext } from '../map/MapContext'

const QUICK_PROMPTS = [
  { label: 'Projects in Cordova', query: 'What are the projects in Cordova?' },
  { label: 'Top projects in Mandaue', query: 'Show top infrastructure projects in Mandaue City' },
  { label: 'Flood mitigation in Cebu City', query: 'What are the flood control projects in Cebu City?' },
  { label: 'Most reported in Cebu', query: 'Which project is the most reported in Cebu?' },
  { label: 'Tell me about 24HH0043', query: 'Tell me about project 24HH0043' },
]

const PROJECT_ID_REGEX = /\b(\d{2}[A-Za-z]{1,2}\d{4,5})\b/g

function renderTextWithProjectChips(text, onChipClick) {
  if (!text) return null
  const parts = []
  let lastIndex = 0
  let match

  while ((match = PROJECT_ID_REGEX.exec(text)) !== null) {
    const start = match.index
    const end = match.index + match[0].length
    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start))
    }
    const pid = match[1].toUpperCase()
    parts.push(
      <button
        key={`chip-${pid}-${start}`}
        type="button"
        onClick={() => onChipClick(pid)}
        className="mx-0.5 inline-flex cursor-pointer items-center gap-1 rounded-md bg-teal-500/20 px-1.5 py-0.5 text-xs font-mono font-semibold text-teal-300 ring-1 ring-teal-400/40 transition hover:bg-teal-500/35 hover:text-white"
        title={`Focus project ${pid} on map`}
      >
        <span>{pid}</span>
      </button>,
    )
    lastIndex = end
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  return parts
}

export default function ChatCopilot() {
  const {
    setSpatialData,
    highlightProject,
    setSelectedProject,
    clearSpatialData,
    setHighlightedProjectId,
    projectDots,
  } = useMapContext()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [messages, setMessages] = useState([])
  const listRef = useRef(null)
  const idRef = useRef(0)
  const abortRef = useRef(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    const node = listRef.current
    if (node) {
      node.scrollTop = node.scrollHeight
    }
  }, [messages, open])

  // Abort any in-flight stream when the component unmounts.
  useEffect(() => () => abortRef.current?.abort(), [])

  const errorMessage = (error) => {
    const byStatus = {
      404: 'Chat endpoint is unavailable — try again after restarting the backend.',
      429: 'Rate limit reached — please wait a moment before asking again.',
      503: 'The knowledge engine is temporarily unavailable.',
    }
    if (error && byStatus[error.status]) return byStatus[error.status]
    return 'Could not connect to the ProjectTRACK knowledge engine. Please check if the server is running.'
  }

  const handleChipClick = (pid) => {
    const matched = projectDots.find(
      (p) => (p.id || '').toUpperCase() === pid.toUpperCase(),
    )
    if (matched && matched.latitude && matched.longitude) {
      highlightProject(pid, [matched.latitude, matched.longitude])
    } else {
      highlightProject(pid)
    }
    if (setSelectedProject) {
      setSelectedProject(pid)
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('projecttrack:open-project', { detail: pid }),
      )
    }
  }

  const handleClear = () => {
    setMessages([])
    // The map pins, LGU selection, and project highlights came from this
    // conversation's spatial context — clearing the chat must clear them too.
    clearSpatialData()
    setSelectedProject(null)
    setHighlightedProjectId(null)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('projecttrack:clear-map'))
    }
  }

  const send = async (text) => {
    const val = (text ?? input).trim()
    if (!val || sending) return
    setInput('')
    setSending(true)

    // Abort any still-running stream so a rapid second send doesn't interleave
    // tokens from two responses into the same reply bubble.
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const history = messages
      .filter((m) => m.text)
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.text }))

    idRef.current += 1
    const replyId = `copilot-${idRef.current}`
    setMessages((prev) => [
      ...prev,
      { id: `user-${idRef.current}`, role: 'user', text: val },
      { id: replyId, role: 'assistant', text: '', streaming: true },
    ])

    const patchReply = (patch) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === replyId ? { ...m, ...patch } : m)),
      )
    }

    try {
      await streamChatMessage({
        message: val,
        history,
        signal: controller.signal,
        onEvent(event, payload) {
          if (event === 'context') {
            if (payload && payload.spatial) {
              startTransition(() => {
                setSpatialData(payload.spatial)
              })
            }
          } else if (event === 'token') {
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
            ? { ...m, text: 'No response received from DPWH knowledge graph.', streaming: false }
            : m.streaming
              ? { ...m, streaming: false }
              : m,
        ),
      )
    } catch (error) {
      // A deliberate abort (new send / unmount) is not a user-facing error.
      if (error?.name === 'AbortError') {
        patchReply({ streaming: false })
      } else {
        patchReply({ text: errorMessage(error), streaming: false })
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setSending(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    send(input)
  }

  return (
    <div className="fixed bottom-5 right-3 z-[1000] font-sans sm:bottom-5 sm:right-5">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group flex cursor-pointer items-center gap-1.5 rounded-full border border-teal-500/40 bg-black/80 px-3 py-1.5 text-[11px] font-semibold text-white shadow-2xl backdrop-blur-xl transition hover:scale-105 hover:border-teal-400 hover:bg-black/95 active:scale-95"
        >
          <span className="flex h-2 w-2 items-center justify-center">
            <span className="relative h-1.5 w-1.5 rounded-full bg-teal-400 shadow-[0_0_6px_#2dd4bf]" />
          </span>
          <span className="bg-gradient-to-r from-teal-200 to-emerald-200 bg-clip-text text-transparent">
            Ask ProjectTrack Watchdog
          </span>
        </button>
      ) : (
        <div
          role="dialog"
          aria-label="ProjectTrack Watchdog"
          aria-modal="false"
          className="flex h-[min(32.5rem,calc(100dvh-6.5rem))] w-[375px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-3xl border border-white/20 bg-black/85 shadow-2xl backdrop-blur-2xl transition sm:w-[410px]"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-xl bg-teal-500/20 text-[11px] font-bold text-teal-300 ring-1 ring-teal-500/30">
                PT
              </span>
              <div>
                <h3 className="text-xs font-bold tracking-wide text-white">
                  ProjectTrack Watchdog
                </h3>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                  <span className="text-[10px] font-medium text-white/60">
                    Online
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleClear}
                title="Clear conversation"
                className="cursor-pointer rounded-lg p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Minimize assistant"
                className="cursor-pointer rounded-lg p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages list */}
          <div ref={listRef} className="flex-1 space-y-3.5 overflow-y-auto p-4 text-xs">
            {messages.length === 0 ? (
              <div className="mt-4 space-y-3 text-center">
                <p className="text-xs leading-relaxed text-white/70">
                  Ask questions about any DPWH infrastructure project, budget,
                  contractor, or municipality in Cebu.
                </p>
                <div className="pt-2">
                  <p className="mb-2 text-[10px] font-semibold tracking-wider text-teal-300/80 uppercase">
                    Suggested Queries
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {QUICK_PROMPTS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => send(p.query)}
                        className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-[11px] text-white/85 transition hover:border-teal-400/40 hover:bg-teal-500/10 hover:text-teal-200"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-teal-600/90 text-white shadow-md'
                        : 'border border-white/10 bg-white/10 text-white/95 shadow-sm'
                    }`}
                  >
                    {m.role === 'user' ? (
                      <p className="whitespace-pre-wrap">{m.text}</p>
                    ) : (
                      <div className="whitespace-pre-wrap">
                        {renderTextWithProjectChips(m.text, handleChipClick)}
                        {m.streaming && (
                          <span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-teal-400" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Quick chip bar when conversation is active */}
          {messages.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto border-t border-white/5 bg-white/[0.02] px-3 py-1.5 text-[10px]">
              {QUICK_PROMPTS.slice(0, 2).map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => send(p.query)}
                  className="shrink-0 cursor-pointer rounded-lg bg-white/5 px-2 py-1 text-white/70 hover:bg-white/10 hover:text-white"
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {/* Input Form */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 border-t border-white/10 bg-black/40 p-2.5"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about projects in Cordova, Toledo…"
              disabled={sending}
              className="flex-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/40 focus:border-teal-400 focus:bg-white/10 focus:outline-none"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="grid h-8 w-8 place-items-center rounded-xl bg-teal-500 text-white transition hover:bg-teal-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
