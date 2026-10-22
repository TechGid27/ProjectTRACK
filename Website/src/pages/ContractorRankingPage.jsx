import { useEffect, useState } from 'react'
import Layout from '../layout/Layout'
import { fetchTopContractors } from '../services/api'

const PAGE_SIZE = 20

function rankStyle(rank) {
  if (rank === 1) return 'bg-amber-400/15 text-amber-600 border-amber-400/40'
  if (rank === 2) return 'bg-gray-300/30 text-gray-600 border-gray-400/40'
  if (rank === 3) return 'bg-orange-400/10 text-orange-600 border-orange-400/40'
  return 'bg-[#1f3d3c]/8 text-[#1f3d3c] border-[#1f3d3c]/20'
}

function ContractorRankingPage() {
  const [contractors, setContractors] = useState(null)
  const [error, setError] = useState(false)
  const [page, setPage] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetchTopContractors(100)
      .then((data) => {
        if (!cancelled) setContractors(data)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const list = contractors ?? []
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageItems = list.slice(
    safePage * PAGE_SIZE,
    (safePage + 1) * PAGE_SIZE,
  )
  const maxBudget = list[0]?.total_budget ?? 1

  return (
    <Layout>
      <section className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-[10px] font-semibold tracking-widest text-[#1f3d3c]/60">
          DPWH CEBU
        </p>
        <h1 className="mt-1 font-serif text-3xl text-gray-a12">
          Contractor Ranking
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-a11">
          Infrastructure firms ranked by total awarded budget across tracked
          DPWH Cebu projects. Codes are DPWH contractor registration numbers.
        </p>

        {error ? (
          <p className="mt-10 text-sm text-gray-a10">
            Couldn&apos;t load contractors — the backend may be offline.
          </p>
        ) : !contractors ? (
          <p className="mt-10 text-sm text-gray-a10">Loading rankings…</p>
        ) : list.length === 0 ? (
          <p className="mt-10 text-sm text-gray-a10">No contractors found.</p>
        ) : (
          <>
            <ol className="mt-8 space-y-3">
              {pageItems.map((contractor, i) => {
                const rank = safePage * PAGE_SIZE + i + 1
                const pctWidth = Math.max(
                  2,
                  Math.round(
                    ((contractor.total_budget ?? 0) / maxBudget) * 100,
                  ),
                )
                return (
                  <li
                    key={`${contractor.code}-${contractor.contractor}`}
                    className="overflow-hidden rounded-2xl border border-gray-a5 bg-white transition hover:border-[#1f3d3c]/30 hover:shadow-sm"
                  >
                    <div className="flex items-start gap-4 px-5 py-4">
                      <span
                        className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-sm font-bold ${rankStyle(rank)}`}
                      >
                        {rank}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-sm font-bold leading-snug text-gray-a12">
                            {contractor.contractor}
                          </h2>
                          {contractor.code && (
                            <span className="rounded-md bg-gray-a3 px-1.5 py-0.5 text-[10px] font-semibold text-gray-a11">
                              #{contractor.code}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-a11">
                          <span>
                            <strong className="font-bold text-[#1f3d3c]">
                              {contractor.total_budget_formatted}
                            </strong>{' '}
                            total awarded
                          </span>
                          <span>
                            {contractor.project_count} project
                            {contractor.project_count !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-a3">
                          <div
                            className="h-full rounded-full bg-[#1f3d3c] transition-all"
                            style={{ width: `${pctWidth}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>

            {list.length > PAGE_SIZE && (
              <div className="mt-6 flex items-center justify-between">
                <button
                  type="button"
                  disabled={safePage === 0}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-xl border border-gray-a5 px-4 py-2 text-sm font-semibold text-gray-a11 transition hover:bg-gray-a2 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f3d3c]"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-a10">
                  Page {safePage + 1} of {pageCount}
                </span>
                <button
                  type="button"
                  disabled={safePage >= pageCount - 1}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-xl border border-gray-a5 px-4 py-2 text-sm font-semibold text-gray-a11 transition hover:bg-gray-a2 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f3d3c]"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </Layout>
  )
}

export default ContractorRankingPage
