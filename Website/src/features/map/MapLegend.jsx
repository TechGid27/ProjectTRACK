import { useState } from 'react'
import { useMapContext } from './MapContext'

export default function MapLegend() {
  const {
    activeLocation,
    projectDots,
    totalLocationProjects,
    displayMode,
    activeStatusFilter,
    loadingAll,
    setStatusFilter,
    loadAllProjects,
    showTop50,
  } = useMapContext()

  const [minimized, setMinimized] = useState(false)

  // Only show when there's an active spatial search or dots
  const hasActiveSpatial = Boolean(activeLocation && projectDots.length > 0)
  const totalCount = totalLocationProjects || projectDots.length
  const currentCount = projectDots.length

  const handleFilterClick = (filter) => {
    setStatusFilter(activeStatusFilter === filter ? 'all' : filter)
  }

  return (
    <div className="w-fit max-w-[min(20rem,calc(100vw-6rem))] select-none">
      <div className="overflow-hidden rounded-2xl border border-white/20 bg-black/60 shadow-2xl backdrop-blur-xl transition">
        {/* Header / Collapse Bar */}
        <button
          type="button"
          onClick={() => setMinimized((v) => !v)}
          aria-expanded={!minimized}
          aria-controls="map-legend-body"
          title={minimized ? 'Expand legend' : 'Minimize legend'}
          className={`flex w-full cursor-pointer items-center justify-between gap-3 px-3.5 py-2 text-left transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white/70 ${
            minimized ? '' : 'border-b border-white/10'
          }`}
        >
          <span className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            <span className="text-xs font-semibold tracking-wide text-white/90">
              {activeLocation ? `${activeLocation} Projects` : 'Project Map Legend'}
            </span>
          </span>
          <svg
            className={`h-3.5 w-3.5 shrink-0 text-white/60 transition-transform duration-300 ${
              minimized ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <div
          id="map-legend-body"
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${
            minimized ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'
          }`}
          aria-hidden={minimized}
          inert={minimized}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="space-y-3 p-3.5 text-xs text-white/80">
              {/* Status filters */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleFilterClick('all')}
                  className={`cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                    activeStatusFilter === 'all'
                      ? 'bg-white/25 text-white shadow-sm'
                      : 'bg-white/5 text-white/65 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => handleFilterClick('ongoing')}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                    activeStatusFilter === 'ongoing'
                      ? 'bg-amber-500/30 text-amber-200 ring-1 ring-amber-400/50'
                      : 'bg-white/5 text-amber-300/80 hover:bg-white/10 hover:text-amber-200'
                  }`}
                >
                  <span className="inline-block h-2 w-2 rotate-45 rounded-[1px] bg-amber-400 shadow-[0_0_6px_#f59e0b]" />
                  Ongoing
                </button>
                <button
                  type="button"
                  onClick={() => handleFilterClick('completed')}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                    activeStatusFilter === 'completed'
                      ? 'bg-emerald-500/30 text-emerald-200 ring-1 ring-emerald-400/50'
                      : 'bg-white/5 text-emerald-300/80 hover:bg-white/10 hover:text-emerald-200'
                  }`}
                >
                  <span className="inline-block h-2 w-2 rotate-45 rounded-[1px] bg-emerald-400 shadow-[0_0_6px_#10b981]" />
                  Completed
                </button>
                <button
                  type="button"
                  onClick={() => handleFilterClick('procurement')}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                    activeStatusFilter === 'procurement'
                      ? 'bg-cyan-500/30 text-cyan-200 ring-1 ring-cyan-400/50'
                      : 'bg-white/5 text-cyan-300/80 hover:bg-white/10 hover:text-cyan-200'
                  }`}
                >
                  <span className="inline-block h-2 w-2 rotate-45 rounded-[1px] bg-cyan-400 shadow-[0_0_6px_#06b6d4]" />
                  Bidding
                </button>
              </div>

              {/* Report verification color key (informational — not a filter) */}
              <div className="space-y-1.5 border-t border-white/10 pt-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
                  Report Verification
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    title="Citizen report with GPS confirmed on-site"
                    className="rounded-full bg-violet-400/25 px-2.5 py-1 text-[11px] font-bold text-violet-200 ring-1 ring-violet-400/60"
                  >
                    On-Site Verified
                  </span>
                  <span
                    title="Citizen report flagged by photo forensics"
                    className="rounded-full bg-rose-400/25 px-2.5 py-1 text-[11px] font-bold text-rose-200 ring-1 ring-rose-400/60"
                  >
                    Photo Flagged
                  </span>
                  <span
                    title="Citizen report without location or forensics verification"
                    className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white/60 ring-1 ring-white/15"
                  >
                    Unverified
                  </span>
                </div>
              </div>

              {/* Density toggle & project counter if active location */}
              {hasActiveSpatial && totalCount > 0 && (
                <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-2.5">
                  <span className="text-[11px] text-white/70">
                    Showing <strong className="text-white">{currentCount}</strong> of{' '}
                    <strong className="text-white">{totalCount}</strong>
                  </span>

                  {totalCount > 50 && (
                    <button
                      type="button"
                      disabled={loadingAll}
                      onClick={() => {
                        if (displayMode === 'top50') {
                          loadAllProjects()
                        } else {
                          showTop50()
                        }
                      }}
                      className="cursor-pointer rounded-lg bg-teal-500/20 px-2.5 py-1 text-[11px] font-semibold text-teal-300 transition hover:bg-teal-500/30 active:scale-95 disabled:opacity-50"
                    >
                      {loadingAll
                        ? 'Loading…'
                        : displayMode === 'top50'
                          ? `Show All (${totalCount})`
                          : 'Show Top 50'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
