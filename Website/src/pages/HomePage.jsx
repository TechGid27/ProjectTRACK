import { Suspense, lazy, useEffect, useState } from 'react'
import Layout from '../layout/Layout'
import { fetchSummary } from '../services/api'
import { CEBU_LGU_NAMES } from '../data/cebuLguNames'

import { MapProvider } from '../features/map/MapContext'

const CebuMap = lazy(() => import('../features/map/CebuMap'))
const ChatCopilot = lazy(() => import('../features/chat/ChatCopilot'))

const CITY_RE = /^(City of |.* City$)/

const FAQS = [
  {
    q: 'What data does ProjectTRACK show?',
    a: 'ProjectTRACK loads DPWH public-works projects for Cebu Province from a Neo4j database — including project ID, description, location, contractor, budget, and status (ongoing, completed with completion percentage, or bidding/procurement).',
  },
  {
    q: 'How do I find projects in my municipality?',
    a: 'Click the municipality polygon on the map, or use the Location Intel panel on the left. You can also use the chat assistant in the bottom-right corner to ask questions like “List ongoing projects in Toledo City.”',
  },
  {
    q: 'What do the map pin colors mean?',
    a: 'Amber diamonds mark ongoing projects, green diamonds completed (100%), cyan diamonds bidding/procurement/planning, and grey diamonds other statuses. The legend’s Report Verification chips (On-Site Verified, Photo Flagged, Unverified) filter the map to projects with citizen reports of that verification tone and re-color the pins to match. When multiple projects share the same coordinate, one pin is drawn — click it to open the full list.',
  },
  {
    q: 'How current is the data?',
    a: 'The project dataset is imported from DPWH published project records. Status percentages reflect the latest recorded progress for each project.',
  },
  {
    q: 'Can I report an incorrect or anomalous entry?',
    a: 'Yes — sign in, open any project’s details from the map, and use the Report Anomaly button to flag issues such as wrong budgets, stale statuses, or incorrect locations. Each report carries your GPS location and photo, and the server verifies it: On-Site Verified (within the site geofence), Photo Flagged (photo forensics or far from the site), or Unverified.',
  },
]

function AboutMapModal({ onClose }) {
  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="About the map"
        onClick={(event) => event.stopPropagation()}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-serif text-xl font-bold text-gray-a12">
            About the map
          </h3>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1 text-gray-a10 transition hover:bg-gray-a3 hover:text-gray-a12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f3d3c]"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <p className="mt-4 text-sm leading-6 text-gray-a11">
          The interactive map shows every DPWH project site in Cebu Province
          loaded from the Neo4j database. Click a municipality polygon to zoom
          in and see its projects, budgets, and statuses in the Location Intel
          panel. Click a diamond pin to open the full project details. Use the
          legend at the top-right to filter projects by status — and to show
          only sites with citizen reports of a given verification tone.
        </p>
        <ul className="mt-5 space-y-2.5 text-sm text-gray-a11">
          <li className="flex items-center gap-2.5">
            <span className="inline-block h-3 w-3 shrink-0 rotate-45 bg-amber-500" />
            Amber diamond — Ongoing project (shows completion %)
          </li>
          <li className="flex items-center gap-2.5">
            <span className="inline-block h-3 w-3 shrink-0 rotate-45 bg-emerald-500" />
            Green diamond — Completed project (100%)
          </li>
          <li className="flex items-center gap-2.5">
            <span className="inline-block h-3 w-3 shrink-0 rotate-45 bg-cyan-500" />
            Cyan diamond — Bidding / procurement / planning
          </li>
          <li className="flex items-center gap-2.5">
            <span className="inline-block h-3 w-3 shrink-0 rotate-45 bg-slate-400" />
            Grey diamond — Other status
          </li>
          <li className="flex items-center gap-2.5">
            <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-gray-a8" />
            Grey outline — Municipality boundary (click to select)
          </li>
        </ul>
        <p className="mt-5 text-sm font-semibold text-gray-a12">
          Report verification legend
        </p>
        <ul className="mt-2.5 space-y-2.5 text-sm text-gray-a11">
          <li className="flex items-center gap-2.5">
            <span className="inline-block h-3 w-3 shrink-0 rotate-45 bg-violet-500" />
            Violet diamond — On-Site Verified citizen report (GPS within the
            project geofence)
          </li>
          <li className="flex items-center gap-2.5">
            <span className="inline-block h-3 w-3 shrink-0 rotate-45 bg-rose-500" />
            Red diamond — Photo Flagged (photo forensics or far from the site)
          </li>
          <li className="flex items-center gap-2.5">
            <span className="inline-block h-3 w-3 shrink-0 rotate-45 bg-gray-400" />
            White diamond — Unverified report (no GPS or forensics signal)
          </li>
        </ul>
        <p className="mt-4 text-sm leading-6 text-gray-a10">
          Click a verification chip in the legend to show only projects with
          that report tone — the visible pins are re-colored to match, and the
          filter stays active while you pan around the open municipality.
        </p>
        <p className="mt-4 text-sm leading-6 text-gray-a10">
          When several projects share the same coordinate, a single pin is
          drawn — clicking it opens a group list so you can pick which project
          to inspect.
        </p>
      </div>
    </div>
  )
}

function HomePage() {
  const [projectCount, setProjectCount] = useState(null)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [faqOpen, setFaqOpen] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchSummary()
      .then((summary) => {
        if (!cancelled) setProjectCount(summary.total_projects)
      })
      .catch(() => {
        if (!cancelled) setProjectCount(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!aboutOpen) return undefined
    function onKey(event) {
      if (event.key === 'Escape') setAboutOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [aboutOpen])

  const names = CEBU_LGU_NAMES
  const cities = names.filter((n) => CITY_RE.test(n)).length
  const townCount = names.length - cities

  return (
    <MapProvider>
      <Layout>
      <Suspense
        fallback={
          <div className="grid h-[80vh] min-h-96 w-full place-items-center bg-gray-a2 lg:h-[91vh]">
            <p className="text-sm text-gray-a10">Loading map…</p>
          </div>
        }
      >
        <CebuMap />
      </Suspense>
      <section className="border-t border-gray-a5">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <h2 className="font-serif text-3xl text-gray-a12">Cebu, in text</h2>
          <p className="mt-4 text-base leading-7 text-gray-a11">
            ProjectTRACK maps public works and infrastructure projects across
            Cebu Province. The map above is interactive — each diamond marker
            is a tracked project site, and its color shows the project’s status
            (ongoing, completed, or bidding) or, when a Report Verification
            filter is on, the verification tone of citizen reports filed for
            it (On-Site Verified, Photo Flagged, Unverified). The pages below
            present the same material as plain text, one page per municipality.
          </p>
          <p className="mt-5 text-sm text-gray-a10">
            {names.length} LGUs ·{' '}
            {projectCount === null ? '—' : projectCount} projects tracked ·{' '}
            {cities} cities · {townCount} municipalities
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#municipalities"
              className="rounded-xl bg-[#1f3d3c] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#16302f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f3d3c]"
            >
              Browse by municipality
            </a>
            <button
              type="button"
              onClick={() => setAboutOpen(true)}
              className="cursor-pointer rounded-xl border border-[#1f3d3c] px-6 py-3 text-sm font-semibold text-[#1f3d3c] transition hover:bg-[#1f3d3c]/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f3d3c]"
            >
              About the map
            </button>
          </div>

          <div id="municipalities" className="mt-14 scroll-mt-20 border-t border-gray-a5 pt-10">
            <h3 className="font-serif text-2xl text-gray-a12">
              Browse by municipality
            </h3>
            <p className="mt-2 text-sm text-gray-a10">
              Click an LGU to select it on the map above.
            </p>
            <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {[...names]
                .sort((a, b) => a.localeCompare(b))
                .map((name) => (
                  <li key={name}>
                    <button
                      type="button"
                      onClick={() => {
                        const mapEl = document.querySelector('.leaflet-container')
                        mapEl?.scrollIntoView({ behavior: 'smooth' })
                        window.dispatchEvent(
                          new CustomEvent('projecttrack:select-lgu', {
                            detail: name,
                          }),
                        )
                      }}
                      className="w-full cursor-pointer rounded-lg border border-gray-a5 bg-gray-a2 px-3 py-2 text-left text-[11px] font-medium text-gray-a11 transition hover:border-[#1f3d3c]/40 hover:bg-[#1f3d3c]/5 hover:text-gray-a12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f3d3c]"
                    >
                      {name}
                    </button>
                  </li>
                ))}
            </ul>
          </div>

          <div className="mt-14 border-t border-gray-a5 pt-10">
            <h3 className="font-serif text-2xl text-gray-a12">
              Frequently asked questions
            </h3>
            <ul className="mt-6 divide-y divide-gray-a5 rounded-xl border border-gray-a5">
              {FAQS.map((faq, index) => (
                <li key={faq.q}>
                  <button
                    type="button"
                    onClick={() =>
                      setFaqOpen(faqOpen === index ? null : index)
                    }
                    aria-expanded={faqOpen === index}
                    className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-semibold text-gray-a12 transition hover:bg-gray-a2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#1f3d3c]"
                  >
                    {faq.q}
                    <svg
                      viewBox="0 0 20 20"
                      className={`h-4 w-4 shrink-0 text-gray-a10 transition-transform ${faqOpen === index ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      aria-hidden="true"
                    >
                      <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {faqOpen === index && (
                    <p className="px-4 pb-4 text-sm leading-6 text-gray-a11">
                      {faq.a}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <Suspense fallback={null}>
        <ChatCopilot />
      </Suspense>
      {aboutOpen && <AboutMapModal onClose={() => setAboutOpen(false)} />}
    </Layout>
  </MapProvider>
)
}

export default HomePage
