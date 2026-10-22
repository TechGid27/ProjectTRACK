import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { divIcon, DomEvent } from 'leaflet'
import { GeoJSON, MapContainer, Marker, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { lguQuery, projectContractor } from '../../data/projectHelpers'
import {
  fetchMapPoints,
  fetchProject,
  fetchProjectReports,
  fetchReportSummaries,
  fetchProjectsByLocation,
  submitAnomalyReport,
} from '../../services/api'
import { getSession } from '../../services/auth'
import { captureGeolocation } from '../../services/geolocation'
import {
  BARANGAY_MIN_ZOOM,
  fetchOsmContextCached,
  featureCentroid,
} from '../../services/overpass'
import { useMapContext } from './MapContext'
import { clusterByProximity } from './cluster'
import MapLegend from './MapLegend'
import VerificationBadges from './VerificationBadges'

const BOUNDS = [
  [9.32, 123.2],
  [11.45, 124.65],
]

const LABEL_MIN_ZOOM = 11

const CONTROL_BTN =
  'grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-black/65 text-white shadow-lg backdrop-blur-md transition hover:bg-black/85 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70'

function labelIcon(name) {
  return divIcon({
    className: '',
    html: `<span class="muni-label">${name}</span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

function barangayLabelIcon(name) {
  return divIcon({
    className: '',
    html: `<span class="bgy-label">${name}</span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

function barangayPlaceIcon(name) {
  return divIcon({
    className: '',
    html: `<span class="bgy-dot"></span><span class="bgy-label bgy-label--place">${name}</span>`,
    iconSize: [8, 8],
    iconAnchor: [4, 4],
  })
}

function getSpatialPinIcon(status, isHighlighted, verificationTone = null) {
  // When a legend verification filter is active, the diamond is painted in the
  // filter's tone (violet/rose/white) so "Photo Flagged" literally shows red
  // diamonds on the map.
  let toneClass
  if (verificationTone === 'verified') {
    toneClass = 'pin--violet'
  } else if (verificationTone === 'flagged') {
    toneClass = 'pin--rose'
  } else if (verificationTone === 'unverified') {
    toneClass = 'pin--white'
  } else {
    toneClass =
      {
        completed: 'pin--emerald',
        ongoing: 'pin--amber',
        bidding: 'pin--cyan',
      }[statusCategory(status)] ?? 'pin--slate'
  }

  const highlightClass = isHighlighted ? ' pin--highlighted' : ''

  return divIcon({
    className: '',
    html: `<span class="project-pin ${toneClass}${highlightClass}"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

function haversineKm(a, b) {
  const R = 6371
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(b[0] - a[0])
  const dLng = toRad(b[1] - a[1])
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function MapAutoResize() {
  const map = useMap()

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])

  return null
}

function MapLabels() {
  const map = useMap()

  useEffect(() => {
    const container = map.getContainer()
    const sync = () =>
      container.classList.toggle('show-labels', map.getZoom() >= LABEL_MIN_ZOOM)

    sync()
    map.on('zoomend', sync)
    return () => {
      map.off('zoomend', sync)
      container.classList.remove('show-labels')
    }
  }, [map])

  return null
}

function MapContextCameraController() {
  const map = useMap()
  const { cameraTarget } = useMapContext()

  useEffect(() => {
    if (!cameraTarget?.center) return
    map.flyTo(cameraTarget.center, cameraTarget.zoom ?? 13, {
      duration: 1.5,
      easeLinearity: 0.25,
    })
  }, [map, cameraTarget])

  return null
}

function MapCamera({ target }) {
  const map = useMap()

  useEffect(() => {
    if (!target) return
    if (target.kind === 'site') {
      map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 13), {
        duration: 0.9,
      })
    } else {
      map.flyTo([target.lat, target.lng], 12, { duration: 0.8 })
    }
  }, [map, target])

  return null
}

function MapBackgroundClick({ onClear }) {
  const map = useMap()

  useEffect(() => {
    const handler = (event) => {
      const target = event.originalEvent?.target
      if (!(target instanceof Element)) return
      if (target.closest('.leaflet-interactive')) return
      if (target.closest('.location-intel-panel')) return
      if (target.closest('[role="dialog"]')) return
      // Legend / map-control clicks must never deselect the current LGU or
      // clear the spatial search — the filters apply live to the open view.
      if (target.closest('.map-controls-overlay')) return
      onClear()
    }
    map.on('click', handler)
    return () => {
      map.off('click', handler)
    }
  }, [map, onClear])

  return null
}

function ZoomWatcher({ onZoom }) {
  const map = useMap()

  useEffect(() => {
    const sync = () => onZoom(map.getZoom())
    sync()
    map.on('zoomend', sync)
    return () => {
      map.off('zoomend', sync)
    }
  }, [map, onZoom])

  return null
}

const BARANGAY_PLACES_MIN_ZOOM = 13

function roadClassName(highway) {
  if (highway === 'motorway' || highway === 'trunk') return 'road road--major'
  if (highway === 'primary') return 'road road--primary'
  if (highway === 'secondary') return 'road road--secondary'
  if (highway === 'residential' || highway === 'unclassified') {
    return 'road road--minor'
  }
  return 'road road--tertiary'
}

let municipalitiesFilePromise = null

function loadMunicipalities() {
  if (!municipalitiesFilePromise) {
    municipalitiesFilePromise = fetch('/data/cebuMunicipalities.json')
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => {
        municipalitiesFilePromise = null
        return null
      })
  }
  return municipalitiesFilePromise
}

let barangayFilePromise = null

function loadCebuBarangays() {
  if (!barangayFilePromise) {
    barangayFilePromise = fetch('/data/cebu-barangays.json')
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => {
        barangayFilePromise = null
        return null
      })
  }
  return barangayFilePromise
}

function findLguBarangays(all, name) {
  if (!all) return null
  if (all[name]) return all[name]
  const key = lguQuery(name)
  const match = Object.keys(all).find((k) => lguQuery(k) === key)
  return match ? all[match] : null
}

function BarangayLayer({ target, visible, zoom }) {
  const [allBarangays, setAllBarangays] = useState(null)
  const [osmState, setOsmState] = useState({ name: null, fc: null })

  useEffect(() => {
    let cancelled = false
    loadCebuBarangays().then((data) => {
      if (!cancelled) setAllBarangays(data)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!visible || !target?.feature) return undefined
    const name = target.name
    fetchOsmContextCached(lguQuery(name), target.feature).then((fc) => {
      if (!cancelled) setOsmState({ name, fc })
    })
    return () => {
      cancelled = true
    }
  }, [visible, target])

  const bgyFc =
    visible && target ? findLguBarangays(allBarangays, target.name) : null
  const osm =
    visible && target && osmState.name === target.name ? osmState.fc : null

  const polygonFeatures = bgyFc ? bgyFc.features : []
  const placeFeatures =
    osm && zoom >= BARANGAY_PLACES_MIN_ZOOM
      ? osm.features.filter((feature) => feature.geometry.type === 'Point')
      : []
  const roadFeatures = osm
    ? osm.features.filter((feature) => feature.geometry.type === 'LineString')
    : []

  if (!polygonFeatures.length && !placeFeatures.length && !roadFeatures.length) {
    return null
  }

  return (
    <>
      {roadFeatures.length > 0 && (
        <GeoJSON
          key={`${target.name}-roads`}
          data={{ type: 'FeatureCollection', features: roadFeatures }}
          style={(feature) => ({
            className: roadClassName(feature.properties.highway),
          })}
        />
      )}
      {polygonFeatures.length > 0 && (
        <GeoJSON
          key={target.name}
          data={{ type: 'FeatureCollection', features: polygonFeatures }}
          style={() => ({ className: 'bgy', fillOpacity: 1 })}
          onEachFeature={(feature, layer) => {
            layer.on('click', (event) => {
              DomEvent.stopPropagation(event.originalEvent)
            })
            layer.bindTooltip(feature.properties.name, {
              sticky: true,
              className: 'pin-label',
              opacity: 1,
            })
          }}
        />
      )}
      {polygonFeatures.map((feature) => {
        const [lng, lat] = featureCentroid(feature)
        return (
          <Marker
            key={`poly-${feature.properties.name}-${lat}-${lng}`}
            position={[lat, lng]}
            icon={barangayLabelIcon(feature.properties.name)}
            interactive={false}
          />
        )
      })}
      {placeFeatures.map((feature) => {
        const [lng, lat] = feature.geometry.coordinates
        return (
          <Marker
            key={`place-${feature.properties.name}-${lat}-${lng}`}
            position={[lat, lng]}
            icon={barangayPlaceIcon(feature.properties.name)}
            interactive={false}
          />
        )
      })}
    </>
  )
}

const CITY_RE = /^(City of |.* City$)/

const WATER_BODIES = [
  { name: 'Visayan Sea', side: 'North' },
  { name: 'Tañon Strait', side: 'West' },
  { name: 'Camotes Sea', side: 'East' },
  { name: 'Cebu Strait', side: 'East' },
]

const STATUS_CLS = {
  Ongoing: 'bg-amber-400/15 text-amber-300',
  Completed: 'bg-emerald-400/15 text-emerald-300',
}

function parseStatus(status) {
  const raw = String(status ?? '')
  const match = raw.match(/(\d+(?:\.\d+)?)\s*%/)
  const pct = match ? Number(match[1]) : null
  const lower = raw.toLowerCase()
  const base = lower.startsWith('completed')
    ? 'Completed'
    : lower.startsWith('on-going') || lower.startsWith('ongoing')
      ? 'Ongoing'
      : raw || 'Unknown'
  return { base, pct }
}

/**
 * Single source of truth for pin colors AND the legend status filter.
 * DPWH statuses like "On-Going (62% Completed)" must classify as ongoing —
 * "ongoing" is checked before the "completed" substring so progress notes
 * never paint an ongoing site green.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function statusCategory(status) {
  const { base, pct } = parseStatus(status)
  const b = String(base ?? '').toLowerCase()
  if (b === 'ongoing') return 'ongoing'
  if (b === 'completed' || pct === 100) return 'completed'
  if (b.includes('bidding') || b.includes('procurement') || b.includes('planning')) {
    return 'bidding'
  }
  const s = String(status ?? '').toLowerCase()
  if (s.includes('ongoing') || s.includes('on-going')) return 'ongoing'
  if (s.includes('complete')) return 'completed'
  if (s.includes('bidding') || s.includes('procurement') || s.includes('planning')) {
    return 'bidding'
  }
  return 'other'
}

function statusBadgeLabel(status) {
  const { base, pct } = parseStatus(status)
  return pct != null ? `${base} · ${pct}%` : base
}

function IntelChip({ children }) {
  return (
    <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-white/70">
      {children}
    </span>
  )
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
      <p className="text-[10px] text-white/50">{label}</p>
      <p className="truncate text-sm font-bold text-white">{value}</p>
    </div>
  )
}

function LocationIntelPanel({
  selected,
  highlight,
  onClose,
  onReset,
  onSelectSite,
  onSelectProject,
  onOpenFullDetails,
  locProjects,
  locError,
  mapPins,
  municipalities,
}) {
  const panelRef = useRef(null)
  const cardRefs = useRef({})
  const [projPage, setProjPage] = useState(0)
  const names = useMemo(
    () => (municipalities?.features ?? []).map((f) => f.properties.name),
    [municipalities],
  )
  const cityCount = useMemo(
    () => names.filter((n) => CITY_RE.test(n)).length,
    [names],
  )

  const nearbySites = useMemo(() => {
    if (!selected) return []
    const origin = [selected.lat, selected.lng]
    // Single pass keeping only the 4 nearest pins — avoids allocating a new
    // array for all ~5000 pins and sorting the whole thing on every selection.
    const top = []
    for (const pin of mapPins) {
      if (pin.name === selected.name) continue
      const km = haversineKm(origin, pin.position)
      if (top.length < 4) {
        top.push({ pin, km })
        if (top.length === 4) top.sort((a, b) => a.km - b.km)
      } else if (km < top[3].km) {
        top[3] = { pin, km }
        top.sort((a, b) => a.km - b.km)
      }
    }
    return top.map(({ pin, km }) => ({ ...pin, km }))
  }, [selected, mapPins])

  const nearbyLgu = useMemo(() => {
    if (!selected || selected.kind !== 'site' || !municipalities) return null
    let best = null
    for (const feature of municipalities.features) {
      if (feature.properties.name === selected.name) continue
      const [lng, lat] = feature.properties.label
      const km = haversineKm([selected.lat, selected.lng], [lat, lng])
      if (!best || km < best.km) best = { name: feature.properties.name, km }
    }
    return best
  }, [selected, municipalities])

  const sitesNearbyLgu = useMemo(() => {
    if (!selected || selected.kind !== 'lgu' || !municipalities) return null
    const feature = municipalities.features.find(
      (f) => f.properties.name === selected.name,
    )
    if (!feature) return null
    const [lng, lat] = feature.properties.label
    return mapPins.filter((pin) => haversineKm([lat, lng], pin.position) <= 30)
      .length
  }, [selected, mapPins, municipalities])

  useEffect(() => {
    const node = panelRef.current
    if (!node) return undefined
    const stop = (event) => event.stopPropagation()
    node.addEventListener('wheel', stop, { passive: true })
    node.addEventListener('touchmove', stop, { passive: true })
    return () => {
      node.removeEventListener('wheel', stop)
      node.removeEventListener('touchmove', stop)
    }
  }, [])

  const panelProjects = locProjects?.projects ?? []
  const panelPageCount = Math.max(
    1,
    Math.ceil(panelProjects.length / PANEL_PAGE_SIZE),
  )
  const [prevHighlight, setPrevHighlight] = useState(highlight)
  if (highlight !== prevHighlight) {
    setPrevHighlight(highlight)
    const idx = highlight
      ? panelProjects.findIndex((p) => p.entity === highlight)
      : -1
    if (idx >= 0) setProjPage(Math.floor(idx / PANEL_PAGE_SIZE))
  }
  const safeProjPage = Math.min(projPage, panelPageCount - 1)
  const pageProjects = panelProjects.slice(
    safeProjPage * PANEL_PAGE_SIZE,
    (safeProjPage + 1) * PANEL_PAGE_SIZE,
  )

  useEffect(() => {
    if (!highlight) return
    const timer = window.setTimeout(() => {
      cardRefs.current[highlight]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [highlight, safeProjPage])

  const kindLabel = selected
    ? selected.kind === 'site'
      ? 'Project site'
      : CITY_RE.test(selected.name)
        ? 'City'
        : 'Municipality'
    : null

  return (
    <div
      ref={panelRef}
      className="location-intel-panel absolute left-2 top-2 z-[1000] flex max-h-[min(18rem,calc(100dvh-16rem))] w-[min(15.5rem,calc(100vw-4.5rem))] flex-col overflow-y-auto rounded-2xl border border-white/10 bg-[#0c1418]/85 shadow-2xl backdrop-blur-md sm:left-3 sm:top-3 sm:max-h-[calc(100%-1.5rem)] sm:w-[290px]"
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h3 className="flex-1 truncate text-sm font-bold text-white">Location Intel</h3>
        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          <span className="hidden sm:inline">Live Active</span>
        </span>
        <button
          type="button"
          aria-label="Close location intel panel"
          onClick={onClose}
          className="ml-1 grid h-6 w-6 place-items-center rounded-md text-white/50 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
        >
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="border-b border-white/10 px-4 py-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold tracking-widest text-white/40">
            CURRENT FOCUS
          </p>
          {selected && (
            <button
              type="button"
              onClick={onReset}
              className="text-[10px] font-semibold text-emerald-400/90 transition hover:text-emerald-300 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400/70"
            >
              Overview
            </button>
          )}
        </div>
        <p className="mt-1.5 font-serif text-xl font-bold text-white">
          {selected ? selected.name : 'Cebu Province'}
        </p>
        <p className="mt-0.5 text-[11px] text-white/50">
          {selected
            ? `${kindLabel} · Central Visayas Region VII`
            : 'Central Visayas Region VII · Philippines'}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {selected ? (
            <>
              <IntelChip>{kindLabel}</IntelChip>
              {selected.kind === 'site' && nearbyLgu && (
                <IntelChip>Near {nearbyLgu.name}</IntelChip>
              )}
              {selected.kind === 'lgu' && (
                <IntelChip>{sitesNearbyLgu ?? 0} sites ≤ 30 km</IntelChip>
              )}
            </>
          ) : (
            <>
              <IntelChip>{cityCount} Cities</IntelChip>
              <IntelChip>Coastal Arch.</IntelChip>
              <IntelChip>{mapPins.length} Sites</IntelChip>
            </>
          )}
        </div>
      </div>

      <div className="border-b border-white/10 px-4 py-4">
        <p className="text-[10px] font-semibold tracking-widest text-white/40">
          TRACKED METRICS
        </p>
        {selected ? (
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <MetricCard label="Classification" value={kindLabel} />
            {selected.kind === 'site' && nearbySites[0] ? (
              <MetricCard
                label="Nearest site"
                value={`${nearbySites[0].km.toFixed(1)} km`}
              />
            ) : (
              <MetricCard label="Sites ≤ 30 km" value={sitesNearbyLgu ?? 0} />
            )}
          </div>
        ) : (
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <MetricCard label="LGUs" value={names.length} />
            <MetricCard label="Project sites" value={mapPins.length} />
            <MetricCard label="Cities" value={cityCount} />
            <MetricCard label="Municipalities" value={names.length - cityCount} />
          </div>
        )}
        <div className="mt-2.5 flex items-center gap-3 text-[10px] text-white/50">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-teal-600" />
            Ongoing
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-sky-600" />
            Completed
          </span>
        </div>
      </div>

      {selected && nearbySites.length > 0 && (
        <div className="border-b border-white/10 px-4 py-4">
          <p className="text-[10px] font-semibold tracking-widest text-white/40">
            NEARBY PROJECT SITES
          </p>
          <ul className="mt-2 space-y-1">
            {nearbySites.map((site) => (
              <li key={site.id}>
                <button
                  type="button"
                  onClick={() => onSelectSite(site)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[11px] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
                >
                  <span className="flex items-center gap-2 text-white/80">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        site.status === 'Completed'
                          ? 'bg-sky-500'
                          : 'bg-teal-600'
                      }`}
                    />
                    {site.name}
                  </span>
                  <span className="text-white/40">
                    {site.km.toFixed(1)} km
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!selected && (
        <div className="border-b border-white/10 px-4 py-4">
          <p className="text-[10px] font-semibold tracking-widest text-white/40">
            SURROUNDING WATER BODIES
          </p>
          <ul className="mt-2 space-y-1.5">
            {WATER_BODIES.map((body) => (
              <li
                key={body.name}
                className="flex items-center justify-between text-[11px]"
              >
                <span className="flex items-center gap-2 text-white/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400/80" />
                  {body.name}
                </span>
                <span className="text-white/40">{body.side}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {selected && (
        <div className="border-b border-white/10 px-4 py-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold tracking-widest text-white/40">
              DPWH PROJECTS
            </p>
            {locProjects && locProjects.total_count > 0 && (
              <span className="text-[10px] text-white/40">
                {locProjects.total_count} · {locProjects.total_budget_formatted}
              </span>
            )}
          </div>
          {locError ? (
            <p className="mt-2 text-[11px] text-white/50">
              Couldn&apos;t load projects — the backend may be offline.
            </p>
          ) : !locProjects ? (
            <p className="mt-2 text-[11px] text-white/50">Loading projects…</p>
          ) : locProjects.projects.length === 0 ? (
            <p className="mt-2 text-[11px] text-white/50">
              No projects found for this location yet.
            </p>
          ) : (
            <>
              <ul className="mt-2 space-y-2">
                {pageProjects.map((project) => {
                  const contractor = projectContractor(project)
                  return (
                    <li
                      key={project.entity}
                      ref={(node) => {
                        if (node) cardRefs.current[project.entity] = node
                        else delete cardRefs.current[project.entity]
                      }}
                      className={`rounded-xl border transition ${
                        highlight === project.entity
                          ? 'border-emerald-400/70 bg-emerald-400/10'
                          : 'border-white/10 bg-white/5'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectProject(project.entity)}
                        className="w-full cursor-pointer rounded-xl px-3 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-white/60">
                            {project.entity}
                          </span>
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${
                              STATUS_CLS[parseStatus(project.status).base] ??
                              'bg-white/10 text-white/60'
                            }`}
                          >
                            {statusBadgeLabel(project.status)}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] leading-snug break-words text-white/80">
                          {project.description}
                        </p>
                        <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px]">
                          <span className="whitespace-nowrap font-bold text-emerald-300">
                            {project.budget}
                          </span>
                          {contractor && (
                            <span className="truncate text-white/50">
                              {contractor}
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
              {panelProjects.length > PANEL_PAGE_SIZE && (
                <div className="mt-2.5 flex items-center justify-between">
                  <button
                    type="button"
                    disabled={safeProjPage === 0}
                    onClick={() => setProjPage((p) => p - 1)}
                    className="rounded-lg border border-white/10 px-2 py-1 text-[10px] font-semibold text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
                  >
                    Previous
                  </button>
                  <span className="text-[10px] text-white/40">
                    {safeProjPage + 1} / {panelPageCount}
                  </span>
                  <button
                    type="button"
                    disabled={safeProjPage >= panelPageCount - 1}
                    onClick={() => setProjPage((p) => p + 1)}
                    className="rounded-lg border border-white/10 px-2 py-1 text-[10px] font-semibold text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="px-4 py-4">
        <button
          type="button"
          disabled={!selected}
          onClick={onOpenFullDetails}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1f3d3c] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#2a5452] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400/70 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Full Details
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M4 10h12M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}

const REPORTS_KEY = 'projecttrack-project-reports'

// Mirrors the backend contract: submit_report() requires
// description = Form(..., min_length=10, max_length=2000).
const MIN_DESCRIPTION_LENGTH = 10

const FULL_DETAILS_PAGE_SIZE = 8
const PANEL_PAGE_SIZE = 5

function FullDetailsModal({ locationName, onClose, onSelectProject }) {
  const [projects, setProjects] = useState(null)
  const [error, setError] = useState(false)
  const [page, setPage] = useState(0)

  useEffect(() => {
    let cancelled = false
    if (!locationName) return undefined
    fetchProjectsByLocation(locationName, 50)
      .then((data) => {
        if (!cancelled) setProjects(data)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [locationName])

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const list = projects?.projects ?? []
  const pageCount = Math.max(1, Math.ceil(list.length / FULL_DETAILS_PAGE_SIZE))
  const pageItems = list.slice(
    page * FULL_DETAILS_PAGE_SIZE,
    (page + 1) * FULL_DETAILS_PAGE_SIZE,
  )

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Full details for ${locationName}`}
      className="fixed inset-0 z-[6000] flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Close full details"
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
      />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c1418]/95 shadow-2xl backdrop-blur-md">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold tracking-widest text-white/40">
              FULL DETAILS
            </p>
            <h2 className="mt-1 font-serif text-xl font-bold text-white">
              {locationName}
            </h2>
            <p className="mt-0.5 text-[11px] text-white/50">
              {projects
                ? `${
                    projects.total_count ?? list.length
                  } project${
                    (projects.total_count ?? list.length) === 1 ? '' : 's'
                  }${
                    projects.total_budget_formatted
                      ? ` · ${projects.total_budget_formatted}`
                      : ''
                  }`
                : 'Loading projects…'}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-white/50 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <p className="text-sm text-white/50">
              Couldn&apos;t load projects — the backend may be offline.
            </p>
          ) : !projects ? (
            <p className="text-sm text-white/50">Loading projects…</p>
          ) : list.length === 0 ? (
            <p className="text-sm text-white/50">
              No projects found for this location yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {pageItems.map((project) => {
                const contractor = projectContractor(project)
                return (
                  <li key={project.entity}>
                    <button
                      type="button"
                      onClick={() => onSelectProject(project.entity)}
                      className="w-full cursor-pointer rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold text-white/60">
                          {project.entity}
                        </span>
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${
                            STATUS_CLS[project.status] ??
                            'bg-white/10 text-white/60'
                          }`}
                        >
                          {project.status}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-snug break-words text-white/80">
                        {project.description}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px]">
                        <span className="whitespace-nowrap font-bold text-emerald-300">
                          {project.budget}
                        </span>
                        {contractor && (
                          <span className="truncate text-white/50">
                            {contractor}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {list.length > FULL_DETAILS_PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3 border-t border-white/10 px-5 py-3">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
            >
              Previous
            </button>
            <span className="text-[11px] text-white/50">
              Page {page + 1} of {pageCount}
            </span>
            <button
              type="button"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function CoordGroupModal({ projects, onClose, onSelectProject }) {
  const count = projects.length
  const top = projects[0]
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Projects in this area`}
      className="fixed inset-0 z-[6000] flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
      />
      <div className="relative z-10 flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c1418]/95 shadow-2xl backdrop-blur-md">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold tracking-widest text-white/40">
              NEARBY PROJECTS
            </p>
            <h2 className="mt-1 font-serif text-lg font-bold text-white">
              {count} project{count !== 1 ? 's' : ''} in this area
            </h2>
            <p className="mt-0.5 text-[11px] text-white/50">
              {top?.position?.[0]?.toFixed(4)}, {top?.position?.[1]?.toFixed(4)}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-white/50 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <ul className="space-y-2">
            {projects.map((project) => {
              const { base, pct } = parseStatus(project.status)
              return (
                <li key={project.id}>
                  <button
                    type="button"
                    onClick={() => onSelectProject(project.id)}
                    className="w-full cursor-pointer rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-white/60">
                        {project.id}
                      </span>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${
                          STATUS_CLS[base] ?? 'bg-white/10 text-white/60'
                        }`}
                      >
                        {statusBadgeLabel(project.status)}
                      </span>
                    </div>
                    {project.name && (
                      <p className="mt-1 truncate text-[11px] text-white/70">
                        {project.name}
                      </p>
                    )}
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px]">
                      <span className="whitespace-nowrap font-bold text-emerald-300">
                        {project.budgetNum != null
                          ? `₱${(project.budgetNum / 1e6).toFixed(1)}M`
                          : ''}
                      </span>
                      {pct != null && (
                        <span className="text-white/40">{pct}%</span>
                      )}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}

/**
 * Derive a Pillar 5 badge (tone + label) from the server's report verdict
 * fields. The backend returns `status` (verified | pending | flagged |
 * rejected) rather than a pre-rendered badge, so clients map it here.
 */
function deriveBadge(report) {
  const status = report?.status
  if (status === 'verified') return { tone: 'success', label: 'On-Site Verified' }
  if (status === 'pending' || status === 'flagged' || status === 'rejected') {
    return { tone: 'warning', label: 'Photo Flagged' }
  }
  return { tone: 'neutral', label: 'Unverified' }
}

const CATEGORY_OPTIONS = [
  { value: 'ghost_project', label: 'Ghost project' },
  { value: 'delay', label: 'Delay' },
  { value: 'substandard_materials', label: 'Substandard materials' },
  { value: 'safety_hazard', label: 'Safety hazard' },
  { value: 'other', label: 'Other' },
]

const VERIFICATION_TONES = [
  {
    tone: 'success',
    label: 'On-Site Verified',
    pill: 'bg-violet-400/25 text-violet-200 ring-violet-400/60',
    diamond: 'bg-violet-400 shadow-[0_0_6px_#8b5cf6]',
  },
  {
    tone: 'warning',
    label: 'Photo Flagged',
    pill: 'bg-rose-400/25 text-rose-200 ring-rose-400/60',
    diamond: 'bg-rose-400 shadow-[0_0_6px_#f43f5e]',
  },
  {
    tone: 'neutral',
    label: 'Unverified',
    pill: 'bg-white/10 text-white/60 ring-white/15',
    diamond: 'bg-white/75 shadow-[0_0_6px_#ffffff80]',
  },
]

function VerificationBadgePill({ badge }) {
  if (!badge) return null
  const meta =
    VERIFICATION_TONES.find((t) => t.tone === badge.tone) ??
    VERIFICATION_TONES[VERIFICATION_TONES.length - 1]
  return (
    <span
      data-testid="report-verification-badge"
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ${meta.pill}`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-2 w-2 shrink-0 rotate-45 rounded-[1px] ${meta.diamond}`}
      />
      {badge.label}
    </span>
  )
}

function ReportAnomalyModal({ entity, defaultLocation, projectCoords, onClose, onSubmitted }) {
  const [signedIn, setSignedIn] = useState(undefined)
  const [sessionUser, setSessionUser] = useState(undefined) // undefined = checking, null = guest
  const [submitting, setSubmitting] = useState(false)
  const [verdict, setVerdict] = useState(null) // ReportVerification after submit
  const [gpsStatus, setGpsStatus] = useState('idle') // idle | acquiring | acquired | denied
  const [farFromSite, setFarFromSite] = useState(null) // km from project site, set once per confirm
  const [catOpen, setCatOpen] = useState(false)
  const [picPreview, setPicPreview] = useState(null) // object URL for the chosen photo
  const catRef = useRef(null)
  const picPreviewRef = useRef(null)
  const [form, setForm] = useState({
    picName: '',
    picFile: null,
    location: defaultLocation ?? '',
    category: 'other',
    desc: '',
    error: '',
  })

  useEffect(() => {
    let cancelled = false
    getSession()
      .then((user) => {
        if (!cancelled) {
          setSessionUser(user ?? null)
          setSignedIn(Boolean(user))
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSessionUser(null)
          setSignedIn(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Close the custom category dropdown on outside click.
  useEffect(() => {
    if (!catOpen) return undefined
    function onClick(event) {
      if (catRef.current && !catRef.current.contains(event.target)) {
        setCatOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [catOpen])

  // Revoke the photo preview object URL when it changes or the modal closes.
  useEffect(() => {
    picPreviewRef.current = picPreview
    return () => {
      if (picPreviewRef.current) URL.revokeObjectURL(picPreviewRef.current)
    }
  }, [picPreview])

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function patch(partial) {
    setForm((prev) => ({ ...prev, ...partial }))
  }

  async function submit(event) {
    event.preventDefault()
    const trimmedDesc = form.desc.trim()
    if (!trimmedDesc) {
      patch({ error: 'Add a short description of what you observed.' })
      return
    }
    // The backend requires a description of at least 10 characters
    // (Form(..., min_length=10)); enforce it client-side so users get an
    // instant, clear message instead of a generic HTTP 422.
    if (trimmedDesc.length < MIN_DESCRIPTION_LENGTH) {
      patch({
        error: `Please add a bit more detail — at least ${MIN_DESCRIPTION_LENGTH} characters (currently ${trimmedDesc.length}).`,
      })
      return
    }
    setSubmitting(true)
    patch({ error: '' })

    // Pillar 1 — capture browser GPS for server-side geofence verification.
    // Never blocks submission: denial/timeout resolves null and the backend
    // tags the report "unverified_no_gps".
    const alreadyConfirmedFar = farFromSite != null
    setGpsStatus('acquiring')
    const gps = await captureGeolocation()
    setGpsStatus(gps ? 'acquired' : 'denied')

    // Client-side preflight: the server geofence is ≤150m. If the device is
    // clearly far from the project site, require an explicit "submit anyway"
    // confirmation instead of silently filing a report that will be flagged.
    if (
      !alreadyConfirmedFar &&
      gps &&
      projectCoords?.latitude != null &&
      projectCoords?.longitude != null
    ) {
      const dKm = haversineKm(
        [gps.latitude, gps.longitude],
        [projectCoords.latitude, projectCoords.longitude],
      )
      if (dKm * 1000 > 150) {
        setFarFromSite(dKm)
        setSubmitting(false)
        return
      }
    }
    setFarFromSite(null)

    try {
      const saved = await submitAnomalyReport({
        projectId: entity,
        description: form.desc.trim(),
        location: form.location.trim(),
        category: form.category,
        picture: form.picFile,
        latitude: gps?.latitude,
        longitude: gps?.longitude,
      })
      setVerdict(saved)
      onSubmitted({
        type: 'anomaly',
        id: saved.id,
        location: form.location.trim(),
        description: form.desc.trim(),
        pictureName: form.picName,
        photoUrl: saved.photo_url ?? null,
        status: saved.status ?? 'pending',
        at: saved.created_at ?? new Date().toISOString(),
        pending: false,
        // Pillar 5 — badge derived client-side from the server's verdict fields.
        badge: deriveBadge(saved),
        distanceMeters: saved.distance_meters ?? null,
        forensicsVerdict: saved.forensics_verdict ?? null,
        geofenceStatus: saved.geofence_pass ? 'inside' : 'outside',
        // Auth identity — only the session that filed the report may see the thank-you.
        submittedBy: sessionUser?.id ?? null,
      })
    } catch (error) {
      let message = error?.message || 'Report submission failed — please try again.'
      if (error?.status === 401) {
        message = 'Sign in to file a report.'
        setSignedIn(false)
        setSessionUser(null)
      } else if (error?.status === 429) {
        message =
          'Daily report limit reached (3 per 24 hours). Please try again tomorrow.'
      }
      patch({ error: message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Report anomaly for ${entity}`}
      className="fixed inset-0 z-[6100] flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Close report form"
        onClick={onClose}
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
      />
      <div className="relative z-10 max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#0c1418]/95 p-5 shadow-2xl backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold tracking-widest text-amber-400/70">
              REPORT ANOMALY
            </p>
            <h2 className="mt-1 font-serif text-lg font-bold text-white">
              {entity}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-white/50 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {signedIn === undefined ? (
          <p className="mt-6 text-sm text-white/50">Checking session…</p>
        ) : verdict ? (
          <div className="mt-6 space-y-3" data-testid="report-verdict">
            <p className="text-sm font-semibold text-white">
              Report submitted and verified
            </p>
            <VerificationBadges report={verdict} />
            <p className="text-[11px] leading-relaxed text-white/60">
              {verdict.status === 'verified'
                ? 'Your report passed the on-site geofence and image forensics checks.'
                : verdict.status === 'flagged'
                  ? 'Your report was recorded but flagged — it failed the geofence or image forensics check.'
                  : 'Your report is pending a closer look at the submitted photo.'}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="flex w-full items-center justify-center rounded-xl bg-[#1f3d3c] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#2a5452]"
            >
              Done
            </button>
          </div>
        ) : signedIn === false ? (
          <div className="mt-6 space-y-3">
            <p className="text-sm leading-relaxed text-white/75">
              You need to be signed in to file an anomaly report. Reports are
              tied to your account so the community can verify them.
            </p>
            <a
              href="/signin"
              onClick={onClose}
              className="flex w-full items-center justify-center rounded-xl bg-[#1f3d3c] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#2a5452] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400/70"
            >
              Sign in to file a report
            </a>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-2.5" noValidate>
            <div>
              <span className="block text-[10px] font-medium text-white/50">
                Picture
              </span>
              <input
                id="anomaly-picture"
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null
                  setPicPreview(file ? URL.createObjectURL(file) : null)
                  patch({ picName: file?.name ?? '', picFile: file })
                }}
                className="sr-only"
              />
              <label
                htmlFor="anomaly-picture"
                className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/5 px-3 py-5 text-[11px] font-semibold text-white/70 transition hover:border-white/40 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
              >
                {picPreview ? (
                  <img
                    src={picPreview}
                    alt="Selected report"
                    className="h-20 w-20 rounded-lg object-cover"
                  />
                ) : (
                  <>
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      aria-hidden="true"
                    >
                      <path
                        d="M3 8.5A2.5 2.5 0 015.5 6h1.7l1.2-2h6.2l1.2 2h1.7A2.5 2.5 0 0121 8.5v9A2.5 2.5 0 0118.5 20h-13A2.5 2.5 0 013 17.5v-9z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="12" cy="13" r="3.4" />
                    </svg>
                    Take a photo or choose from gallery
                  </>
                )}
              </label>
              {form.picName && (
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-[11px] text-white/60">
                    {form.picName}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPicPreview(null)
                      const input = document.getElementById('anomaly-picture')
                      if (input) input.value = ''
                      patch({ picName: '', picFile: null })
                    }}
                    className="shrink-0 cursor-pointer text-[10px] font-semibold text-red-400 transition hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
            <div>
              <label
                htmlFor="anomaly-location"
                className="block text-[10px] font-medium text-white/50"
              >
                Location
              </label>
              <input
                id="anomaly-location"
                type="text"
                value={form.location}
                onChange={(event) => patch({ location: event.target.value })}
                placeholder="Barangay / street / landmark"
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-[11px] text-white placeholder:text-white/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
              />
            </div>
            <div className="relative" ref={catRef}>
              <span
                id="anomaly-category-label"
                className="block text-[10px] font-medium text-white/50"
              >
                Category
              </span>
              <button
                type="button"
                id="anomaly-category"
                aria-haspopup="listbox"
                aria-expanded={catOpen}
                aria-labelledby="anomaly-category-label"
                onClick={() => setCatOpen((open) => !open)}
                className="mt-1 flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-left text-[11px] text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
              >
                <span className="min-w-0 truncate">
                  {CATEGORY_OPTIONS.find((opt) => opt.value === form.category)
                    ?.label ?? 'Other'}
                </span>
                <svg
                  viewBox="0 0 20 20"
                  className={`h-3.5 w-3.5 shrink-0 text-white/50 transition-transform ${catOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {catOpen && (
                <ul
                  role="listbox"
                  aria-label="Category"
                  className="absolute inset-x-0 top-full z-[20] mt-1 max-h-44 overflow-y-auto rounded-lg border border-white/15 bg-[#101a1e] shadow-2xl"
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <li key={opt.value}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={form.category === opt.value}
                        onClick={() => {
                          patch({ category: opt.value })
                          setCatOpen(false)
                        }}
                        className={`w-full cursor-pointer px-3 py-2 text-left text-[11px] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white/70 ${
                          form.category === opt.value
                            ? 'bg-white/10 font-semibold text-white'
                            : 'text-white/75'
                        }`}
                      >
                        {opt.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <label
                htmlFor="anomaly-description"
                className="block text-[10px] font-medium text-white/50"
              >
                Description
              </label>
              <textarea
                id="anomaly-description"
                rows={3}
                value={form.desc}
                minLength={MIN_DESCRIPTION_LENGTH}
                onChange={(event) => patch({ desc: event.target.value, error: '' })}
                placeholder="What did you observe? (at least 10 characters)"
                className="mt-1 w-full resize-none rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-[11px] text-white placeholder:text-white/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
              />
              <p className="mt-1 text-right text-[10px] text-white/40">
                {form.desc.trim().length < MIN_DESCRIPTION_LENGTH
                  ? `${form.desc.trim().length}/${MIN_DESCRIPTION_LENGTH} characters minimum`
                  : `${form.desc.trim().length} characters`}
              </p>
            </div>
            {gpsStatus !== 'idle' && (
              <p
                role="status"
                data-testid="gps-status"
                className={`rounded-lg px-2.5 py-1.5 text-[10px] font-semibold ${
                  gpsStatus === 'acquired'
                    ? 'bg-violet-400/25 text-violet-200'
                    : gpsStatus === 'denied'
                      ? 'bg-white/10 text-white/50'
                      : 'bg-violet-400/10 text-violet-300/70'
                }`}
              >
                {gpsStatus === 'acquiring' && 'Acquiring GPS…'}
                {gpsStatus === 'acquired' && 'GPS acquired — will verify on-site'}
                {gpsStatus === 'denied' && 'No GPS — report will be unverified'}
              </p>
            )}
            {farFromSite != null && (
              <div
                role="alert"
                data-testid="far-from-site-warning"
                className="rounded-lg border border-amber-400/40 bg-amber-500/15 px-2.5 py-2 text-[11px] font-semibold text-amber-200"
              >
                You are{' '}
                {farFromSite < 1
                  ? `${Math.round(farFromSite * 1000)} m`
                  : `${farFromSite.toFixed(1)} km`}{' '}
                from this project site. Reports far from the site will be
                marked <strong>Photo Flagged</strong> by server verification.
                <button
                  type="button"
                  onClick={() => setFarFromSite(null)}
                  className="ml-1.5 cursor-pointer underline underline-offset-2 transition hover:text-amber-100"
                >
                  Dismiss
                </button>
              </div>
            )}
            {form.error && (
              <p role="alert" className="text-[11px] font-semibold text-red-500">
                {form.error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-xl bg-amber-500/90 px-3 py-2 text-[11px] font-semibold text-black transition hover:bg-amber-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400/70 disabled:opacity-60"
              >
                {submitting
                  ? 'Submitting…'
                  : farFromSite != null
                    ? 'Submit anyway (will be flagged)'
                    : 'Submit Report'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/10 px-3 py-2 text-[11px] font-semibold text-white/60 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function readReport(id) {
  try {
    const all = JSON.parse(window.localStorage.getItem(REPORTS_KEY) ?? '{}')
    return all[id] ?? null
  } catch {
    return null
  }
}

function writeReport(id, value) {
  try {
    const all = JSON.parse(window.localStorage.getItem(REPORTS_KEY) ?? '{}')
    all[id] = value
    window.localStorage.setItem(REPORTS_KEY, JSON.stringify(all))
  } catch {
    // storage unavailable — report only kept in component state
  }
}

function ProjectDetailModal({ entity, onClose }) {
  const [detailState, setDetailState] = useState({ id: null, data: null })
  const [reportState, setReportState] = useState({ id: null, value: null })
  const [reportsState, setReportsState] = useState({ id: null, list: [] })
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [reportFilter, setReportFilter] = useState('all') // 'all' | badge tone
  const [reportPage, setReportPage] = useState(1)
  const [viewer, setViewer] = useState(undefined) // undefined = checking, null = guest

  // Fresh project → start from the full list, page 1 (render-phase reset).
  const [prevReportEntity, setPrevReportEntity] = useState(entity)
  if (prevReportEntity !== entity) {
    setPrevReportEntity(entity)
    setReportFilter('all')
    setReportPage(1)
  }

  useEffect(() => {
    let cancelled = false
    getSession()
      .then((user) => {
        if (!cancelled) setViewer(user ?? null)
      })
      .catch(() => {
        if (!cancelled) setViewer(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const report =
    reportState.id === entity
      ? reportState.value
      : entity
        ? readReport(entity)
        : null

  useEffect(() => {
    let cancelled = false
    if (!entity) return undefined
    fetchProject(entity)
      .then((data) => {
        if (!cancelled) setDetailState({ id: entity, data })
      })
      .catch(() => {
        if (!cancelled) setDetailState({ id: entity, data: null })
      })
    fetchProjectReports(entity)
      .then((data) => {
        if (cancelled) return
        setReportsState({
          id: entity,
          list: (data.reports ?? []).map((latest) => ({
            type: 'anomaly',
            id: latest.id,
            location: latest.location ?? '',
            description: latest.description,
            pictureName: '',
            photoUrl: latest.photo_url ?? null,
            at: latest.created_at,
            pending: false,
            // Pillar 5 — badge derived client-side from the server's verdict.
            badge: deriveBadge(latest),
            distanceMeters: latest.distance_meters ?? null,
            forensicsVerdict: latest.forensics_verdict ?? null,
            geofenceStatus: latest.geofence_pass ? 'inside' : 'outside',
          })),
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [entity])

  useEffect(() => {
    if (!entity) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [entity, onClose])

  if (!entity) return null
  const project = detailState.id === entity ? detailState.data : null

  // Newest-first list: local (just submitted / offline-pending) + all fetched,
  // deduped by id so an online submission isn't shown twice.
  const fetchedReports = reportsState.id === entity ? reportsState.list : []
  const fetchedIds = new Set(fetchedReports.map((r) => r.id))
  const reportList = [
    ...(report && !fetchedIds.has(report.id) ? [report] : []),
    ...[...fetchedReports].reverse(),
  ]
  const verificationCounts = reportList.reduce((acc, r) => {
    const tone = r.badge?.tone ?? 'neutral'
    acc[tone] = (acc[tone] ?? 0) + 1
    return acc
  }, {})

  // Only the signed-in reporter who actually filed this local report may see
  // the thank-you / "saved on this device" confirmation. Guests and other
  // accounts never see it (the report itself is still public in the list).
  const canSeeThankYou = Boolean(
    report?.submittedBy && viewer?.id && viewer.id === report.submittedBy,
  )

  // Community-report filter chips + pagination.
  const REPORTS_PER_PAGE = 6
  const filteredReports =
    reportFilter === 'all'
      ? reportList
      : reportList.filter((r) => (r.badge?.tone ?? 'neutral') === reportFilter)
  const pageCount = Math.max(1, Math.ceil(filteredReports.length / REPORTS_PER_PAGE))
  const currentPage = Math.min(reportPage, pageCount)
  const pageReports = filteredReports.slice(
    (currentPage - 1) * REPORTS_PER_PAGE,
    currentPage * REPORTS_PER_PAGE,
  )
  const filterChips = [
    { key: 'all', label: 'All Anomalies', count: reportList.length },
    ...VERIFICATION_TONES.filter((t) => (verificationCounts[t.tone] ?? 0) > 0).map(
      (t) => ({
        key: t.tone,
        label:
          t.tone === 'success' ? 'On-Site' : t.tone === 'warning' ? 'Photo Flagged' : 'Unverified',
        count: verificationCounts[t.tone],
        tone: t,
      }),
    ),
  ]

  const rows = project
    ? [
        ['Budget', project.budget],
        ['Status', project.status],
        ['Timeline', project.timeline],
        ['Contractor', project.contractor],
        ['Contractor code', project.contractor_code],
        ['Location', project.location],
        ['Office', project.office],
        ['Category', project.category],
      ]
    : []

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`DPWH project ${entity} details`}
      className="fixed inset-0 z-[6000] flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Close project details"
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
      />
      <div className="relative mt-15  z-10 max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#0c1418]/95 p-5 shadow-2xl backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold tracking-widest text-white/40">
              DPWH PROJECT
            </p>
            <h2 className="mt-1 font-serif text-xl font-bold text-white">
              {entity}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-white/50 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {!project ? (
          <p className="mt-6 text-sm text-white/50">
            Loading project details…
          </p>
        ) : (
          <>
            <p className="mt-3 text-sm leading-relaxed break-words text-white/85">
              {project.description}
            </p>
            {(() => {
              const { base, pct } = parseStatus(project.status)
              if (pct == null) return null
              return (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-[11px]">
                    <span
                      className={`font-semibold ${
                        base === 'Completed'
                          ? 'text-sky-300'
                          : 'text-emerald-300'
                      }`}
                    >
                      {base} · {pct}% complete
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full ${
                        base === 'Completed' ? 'bg-sky-400' : 'bg-emerald-400'
                      }`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              )
            })()}
            <dl className="mt-4 space-y-2">
              {rows.map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-start justify-between gap-4 border-b border-white/5 pb-2 text-[12px]"
                >
                  <dt className="shrink-0 text-white/45">{label}</dt>
                  <dd className="break-words text-right font-medium text-white/90">
                    {value ?? '—'}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-3">
              <p className="text-[10px] font-semibold tracking-widest text-white/40">
                COMMUNITY REPORT
              </p>
              <p className="mt-1.5 text-[11px] leading-snug text-white/60">
                Observed an anomaly on-site? Send a report with a picture,
                location, and short description.
              </p>
              {reportList.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setReportModalOpen(true)}
                  className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-400/40 bg-red-400/10 px-3 py-2 text-[11px] font-semibold text-red-300 transition hover:bg-red-400/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400/70"
                >
                  <svg
                    viewBox="0 0 20 20"
                    className="h-3.5 w-3.5 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <path
                      d="M10 2.5L1.5 17h17L10 2.5z"
                      strokeLinejoin="round"
                    />
                    <path d="M10 8v3.5" strokeLinecap="round" />
                    <circle cx="10" cy="14" r="0.6" fill="currentColor" />
                  </svg>
                  Report Anomaly
                </button>
              ) : (
                <div className="mt-2.5 space-y-2.5">
                  {/* Aggregate verification summary */}
                  <p
                    data-testid="report-verification-summary"
                    className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-white/70"
                  >
                    <span className="font-semibold text-white/90">
                      {reportList.length}{' '}
                      {reportList.length === 1 ? 'report' : 'reports'}
                    </span>
                    {VERIFICATION_TONES.filter(
                      (t) => (verificationCounts[t.tone] ?? 0) > 0,
                    ).map((t) => (
                      <span
                        key={t.tone}
                        className="inline-flex items-center gap-1"
                      >
                        <span
                          aria-hidden="true"
                          className={`inline-block h-2 w-2 shrink-0 rotate-45 rounded-[1px] ${t.diamond}`}
                        />
                        {verificationCounts[t.tone]} {t.label}
                      </span>
                    ))}
                  </p>
                  {/* Filter by verification tone (single-select) */}
                  <div className="flex flex-wrap gap-1.5">
                    {filterChips.map((chip) => {
                      const active = reportFilter === chip.key
                      const activeCls =
                        chip.key === 'success'
                          ? 'bg-violet-500/30 text-violet-200 ring-1 ring-violet-400/60'
                          : chip.key === 'warning'
                            ? 'bg-rose-500/30 text-rose-200 ring-1 ring-rose-400/60'
                            : 'bg-white/20 text-white ring-1 ring-white/40'
                      const idleCls =
                        chip.key === 'success'
                          ? 'bg-violet-400/15 text-violet-300/90 ring-1 ring-violet-400/30'
                          : chip.key === 'warning'
                            ? 'bg-rose-400/15 text-rose-300/90 ring-1 ring-rose-400/30'
                            : 'bg-white/10 text-white/70 ring-1 ring-white/15'
                      return (
                        <button
                          key={chip.key}
                          type="button"
                          aria-pressed={active}
                          onClick={() => {
                            setReportFilter(chip.key)
                            setReportPage(1)
                          }}
                          className={`flex cursor-pointer items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold transition hover:brightness-125 ${active ? activeCls : idleCls}`}
                        >
                          {chip.tone ? (
                            <span
                              aria-hidden="true"
                              className={`inline-block h-1.5 w-1.5 shrink-0 rotate-45 rounded-[1px] ${chip.tone.diamond}`}
                            />
                          ) : null}
                          {chip.label} · {chip.count}
                        </button>
                      )
                    })}
                  </div>
                  {canSeeThankYou && (
                    <p
                      role="status"
                      className="rounded-lg bg-violet-400/15 px-3 py-2 text-[11px] font-semibold text-violet-300"
                    >
                      {report.pending
                        ? 'Report saved on this device — server was unreachable, it will not appear for others yet.'
                        : 'Thank you — your anomaly report for this project was submitted.'}
                    </p>
                  )}
                  {pageReports.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-white/15 px-3 py-2.5 text-center text-[11px] text-white/50">
                      No reports match this filter.
                    </p>
                  ) : (
                    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {pageReports.map((item) => (
                        <li
                          key={item.id ?? `${item.at}-${item.description}`}
                          className="flex flex-col rounded-lg border border-white/10 bg-black/20 px-2.5 py-2"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                            <VerificationBadgePill badge={item.badge} />
                            <span className="text-[10px] text-white/40">
                              {item.distanceMeters != null
                                ? `${item.distanceMeters}m from site`
                                : item.geofenceStatus === 'inside'
                                  ? 'On-site'
                                  : 'GPS not verified'}
                              {item.at
                                ? ` · ${new Date(item.at).toLocaleString()}`
                                : ''}
                            </span>
                          </div>
                          <p className="mt-1.5 text-[11px] leading-snug text-white/80">
                            {item.description}
                          </p>
                          {item.photoUrl && (
                            <img
                              src={item.photoUrl}
                              alt="Reported anomaly evidence"
                              loading="lazy"
                              className="mt-1.5 max-h-32 w-full rounded-md object-cover"
                            />
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {pageCount > 1 && (
                    <div className="flex items-center justify-between gap-2 pt-0.5 text-[10px]">
                      <button
                        type="button"
                        disabled={currentPage <= 1}
                        onClick={() => setReportPage(currentPage - 1)}
                        className="rounded-full bg-white/10 px-2.5 py-1 font-semibold text-white/80 ring-1 ring-white/15 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        Previous
                      </button>
                      <span className="text-white/50">
                        Page {currentPage} of {pageCount}
                      </span>
                      <button
                        type="button"
                        disabled={currentPage >= pageCount}
                        onClick={() => setReportPage(currentPage + 1)}
                        className="rounded-full bg-white/10 px-2.5 py-1 font-semibold text-white/80 ring-1 ring-white/15 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            {project.url && (
              <a
                href={project.url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1f3d3c] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#2a5452] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400/70"
              >
                View on BetterGov
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M8 4H4v12h12v-4M12 4h4v4M16 4l-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            )}
          </>
        )}
      </div>
      {reportModalOpen && (
        <ReportAnomalyModal
          entity={entity}
          defaultLocation={(detailState.id === entity ? detailState.data?.location : '') ?? ''}
          projectCoords={
            detailState.id === entity &&
            detailState.data?.latitude != null &&
            detailState.data?.longitude != null
              ? {
                  latitude: detailState.data.latitude,
                  longitude: detailState.data.longitude,
                }
              : null
          }
          onClose={() => setReportModalOpen(false)}
          onSubmitted={(merged) => {
            writeReport(entity, merged)
            setReportState({ id: entity, value: merged })
            setReportModalOpen(false)
          }}
        />
      )}
    </div>
  )
}

function MapControls() {
  const map = useMap()

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        aria-label="Zoom in"
        onClick={() => map.zoomIn()}
        className={CONTROL_BTN}
      >
        <svg
          viewBox="0 0 20 20"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path
            d="M10 5v10M5 10h10"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Zoom out"
        onClick={() => map.zoomOut()}
        className={CONTROL_BTN}
      >
        <svg
          viewBox="0 0 20 20"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="M5 10h10" strokeLinecap="round" />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Reset view"
        onClick={() =>
          map.fitBounds(BOUNDS, { padding: [16, 16], animate: true })
        }
        className={CONTROL_BTN}
      >
        <svg
          viewBox="0 0 20 20"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <circle cx="10" cy="10" r="3.2" />
          <path
            d="M10 2.5v3M10 14.5v3M2.5 10h3M14.5 10h3"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  )
}

function CebuMap() {
  const {
    activeLocation: spatialLocation,
    clearSpatialData,
    projectDots,
    activeStatusFilter,
    activeVerificationFilter,
    highlightedProjectId,
    highlightProject,
  } = useMapContext()

  // Phones start with the intel panel closed so it doesn't overlap the
  // legend/controls on the right — the "Location Intel" button re-opens it.
  const [intelOpen, setIntelOpen] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 768,
  )
  const [selected, setSelected] = useState(null)
  const [zoom, setZoom] = useState(8)
  const [highlightEntity, setHighlightEntity] = useState(null)
  const [detailEntity, setDetailEntity] = useState(null)
  const [fullDetails, setFullDetails] = useState(null)
  const [coordGroup, setCoordGroup] = useState(null)
  const [mapPins, setMapPins] = useState([])
  const [lguPinState, setLguPinState] = useState({ name: null, pins: [] })
  const [municipalities, setMunicipalities] = useState(null)
  // projectId -> { onSite, flagged, unverified, total } from GET /reports/summaries
  const [reportSummaries, setReportSummaries] = useState(null)
  const [locState, setLocState] = useState({
    name: null,
    data: null,
    error: false,
  })

  useEffect(() => {
    let cancelled = false
    fetchReportSummaries()
      .then((data) => {
        if (cancelled) return
        const map = new Map()
        for (const s of data?.summaries ?? []) {
          map.set(s.project_id, {
            onSite: s.on_site ?? 0,
            flagged: s.flagged ?? 0,
            unverified: s.unverified ?? 0,
            total: s.total ?? 0,
          })
        }
        setReportSummaries(map)
      })
      .catch(() => {
        // Report datastore unavailable (e.g. migrations not applied yet) —
        // verification filters simply match nothing until it is reachable.
        if (!cancelled) setReportSummaries(new Map())
      })
    return () => {
      cancelled = true
    }
  }, [])

  const matchesStatusFilter = useCallback(
    (status) => {
      if (activeStatusFilter === 'all') return true
      const category = statusCategory(status)
      if (activeStatusFilter === 'completed') return category === 'completed'
      if (activeStatusFilter === 'ongoing') return category === 'ongoing'
      if (activeStatusFilter === 'procurement') return category === 'bidding'
      return true
    },
    [activeStatusFilter],
  )

  const matchesVerificationFilter = useCallback(
    (projectId) => {
      if (activeVerificationFilter === 'all') return true
      const summary = reportSummaries?.get(projectId)
      if (!summary) return false
      if (activeVerificationFilter === 'verified') return summary.onSite > 0
      if (activeVerificationFilter === 'flagged') return summary.flagged > 0
      // 'anomalies' — any project that has at least one citizen report,
      // regardless of its verification tone.
      return (
        (summary.onSite ?? 0) +
          (summary.flagged ?? 0) +
          (summary.unverified ?? 0) >
        0
      )
    },
    [activeVerificationFilter, reportSummaries],
  )

  // Only paint a tone-specific pin colour for the single-tone filters. The
  // 'anomalies' filter keeps each pin's status colour so mixed report types
  // stay distinguishable on the map.
  const verificationTone =
    activeVerificationFilter === 'verified' ||
    activeVerificationFilter === 'flagged'
      ? activeVerificationFilter
      : null

  const filteredSpatialDots = useMemo(() => {
    if (!projectDots || projectDots.length === 0) return []
    return projectDots.filter(
      (d) => matchesStatusFilter(d.status) && matchesVerificationFilter(d.id),
    )
  }, [projectDots, matchesStatusFilter, matchesVerificationFilter])

  // Deterministic micro-dispersion for projects sharing exact coordinates
  const displaySpatialDots = useMemo(() => {
    if (!filteredSpatialDots || filteredSpatialDots.length === 0) return []

    // Cluster markers that are close ON SCREEN at the current zoom (not just
    // those sharing an exact coordinate), then fan out each cluster so every
    // project stays individually visible and clickable. As the user zooms in,
    // the pixel threshold covers less ground, so clusters separate naturally.
    const clusters = clusterByProximity(
      filteredSpatialDots.filter((d) => d.latitude != null && d.longitude != null),
      zoom,
      (d) => [Number(d.latitude), Number(d.longitude)],
    )

    const dispersed = []
    for (const cluster of clusters) {
      const group = cluster.items
      if (group.length === 1) {
        dispersed.push({
          ...group[0],
          displayLat: group[0].latitude,
          displayLng: group[0].longitude,
        })
      } else {
        // Fan the colliding points out around the cluster anchor. The radius is
        // scaled to the current zoom so the spread stays visually consistent.
        const spreadPx = 16
        const dLat = spreadPx * (360 / (256 * Math.pow(2, zoom)))
        group.forEach((dot, idx) => {
          const angle = (idx * 2 * Math.PI) / group.length
          const cosLat = Math.cos((dot.latitude * Math.PI) / 180) || 1
          const dLng = dLat / cosLat
          dispersed.push({
            ...dot,
            displayLat: dot.latitude + dLat * Math.sin(angle),
            displayLng: dot.longitude + dLng * Math.cos(angle),
          })
        })
      }
    }
    return dispersed
  }, [filteredSpatialDots, zoom])

  const isSpatialActive = useMemo(() => {
    if (!displaySpatialDots || displaySpatialDots.length === 0) return false
    if (!spatialLocation) return false
    if (selected?.kind === 'lgu') {
      const sName = selected.name.toLowerCase()
      const spName = spatialLocation.toLowerCase()
      return sName.includes(spName) || spName.includes(sName)
    }
    return !selected
  }, [displaySpatialDots, spatialLocation, selected])

  const onZoom = useCallback((value) => setZoom(value), [])

  useEffect(() => {
    let cancelled = false
    loadMunicipalities().then((data) => {
      if (!cancelled) setMunicipalities(data)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const lastRequestedLguRef = useRef(null)

  useEffect(() => {
    function onSelectLgu(event) {
      const name = event?.detail
      if (!name) return
      lastRequestedLguRef.current = name
      if (!municipalities) return
      const target = String(name).trim().toLowerCase()
      const feature = municipalities.features.find((f) => {
        const fn = f.properties.name.toLowerCase()
        return fn === target || target.includes(fn) || fn.includes(target)
      })
      if (!feature) return
      const [lng, lat] = feature.properties.label
      setHighlightEntity(null)
      setSelected({ kind: 'lgu', name: feature.properties.name, lat, lng, feature })
      setIntelOpen(true)
    }
    window.addEventListener('projecttrack:select-lgu', onSelectLgu)
    if (municipalities && lastRequestedLguRef.current) {
      onSelectLgu({ detail: lastRequestedLguRef.current })
      lastRequestedLguRef.current = null
    }
    return () =>
      window.removeEventListener('projecttrack:select-lgu', onSelectLgu)
  }, [municipalities])

  useEffect(() => {
    // Copilot "clear conversation" also resets the map selection/highlights.
    function onClearMap() {
      setSelected(null)
      setHighlightEntity(null)
    }
    window.addEventListener('projecttrack:clear-map', onClearMap)
    return () => window.removeEventListener('projecttrack:clear-map', onClearMap)
  }, [])

  useEffect(() => {
    function onOpenProject(event) {
      const pid = event.detail
      if (!pid) return
      setHighlightEntity(pid)
      setDetailEntity(pid)
    }
    window.addEventListener('projecttrack:open-project', onOpenProject)
    return () =>
      window.removeEventListener('projecttrack:open-project', onOpenProject)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchMapPoints(5000)
      .then((points) => {
        if (cancelled) return
        setMapPins(
          points.map((point) => ({
            id: point.id,
            name: point.formatted_address || point.municipality || point.id,
            position: [point.latitude, point.longitude],
            status: point.status || null,
            municipality: point.municipality || null,
            budgetNum: point.budget_num ?? null,
          })),
        )
      })
      .catch(() => {
        if (!cancelled) setMapPins([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Send the full canonical LGU name to the backend. The API normalizes
  // "City of X" / "X City" and isolates projects by exact municipality, so
  // stripping the " City" suffix here would broaden the query and leak dots
  // from other LGUs (e.g. "Cebu City" -> "Cebu" matched the whole province).
  const queryName = selected ? selected.name : null
  const locProjects =
    queryName && locState.name === queryName ? locState.data : null
  const locError =
    queryName && locState.name === queryName ? locState.error : false

  useEffect(() => {
    let cancelled = false
    if (!queryName) return undefined
    fetchMapPoints(500, queryName)
      .then((points) => {
        if (cancelled) return
        setLguPinState({
          name: queryName,
          pins: points.map((point) => ({
            id: point.id,
            name: point.formatted_address || point.municipality || point.id,
            position: [point.latitude, point.longitude],
            status: point.status || null,
            budgetNum: point.budget_num ?? null,
          })),
        })
      })
      .catch(() => {
        if (!cancelled) setLguPinState({ name: queryName, pins: [] })
      })
    return () => {
      cancelled = true
    }
  }, [queryName])

  useEffect(() => {
    let cancelled = false
    if (!queryName) return undefined
    fetchProjectsByLocation(queryName, 100)
      .then((data) => {
        if (!cancelled) setLocState({ name: queryName, data, error: false })
      })
      .catch(() => {
        if (!cancelled) setLocState({ name: queryName, data: null, error: true })
      })
    return () => {
      cancelled = true
    }
  }, [queryName])

  function selectSite(pin) {
    setHighlightEntity(null)
    setSelected({
      kind: 'site',
      name: pin.name,
      lat: pin.position[0],
      lng: pin.position[1],
    })
    setIntelOpen(true)
    clearSpatialData()
  }

  function selectLgu(feature) {
    const name = feature.properties.name
    if (selected?.kind === 'lgu' && selected.name === name) {
      setSelected(null)
      clearSpatialData()
      return
    }
    const [lng, lat] = feature.properties.label
    setHighlightEntity(null)
    setSelected({
      kind: 'lgu',
      name,
      lat,
      lng,
      feature,
    })
    setIntelOpen(true)
    if (
      spatialLocation &&
      !name.toLowerCase().includes(spatialLocation.toLowerCase()) &&
      !spatialLocation.toLowerCase().includes(name.toLowerCase())
    ) {
      clearSpatialData()
    }
  }

  const showDetail =
    zoom >= BARANGAY_MIN_ZOOM && selected?.kind === 'lgu'
  const showProjectPins = selected?.kind === 'lgu'

  function openProjectDetail(entity) {
    if (!entity) return
    setHighlightEntity(entity)
    setDetailEntity(entity)
  }

  const selectedProjects = useMemo(() => {
    if (selected?.kind !== 'lgu') return []
    const pins = (
      lguPinState.name === queryName ? lguPinState.pins : []
    ).filter(
      (pin) =>
        matchesStatusFilter(pin.status) && matchesVerificationFilter(pin.id),
    )
    if (pins.length === 0) return []

    const sorted = [...pins].sort(
      (a, b) => (b.budgetNum ?? 0) - (a.budgetNum ?? 0),
    )

    // Group pins that overlap ON SCREEN at the current zoom (projects that are
    // close, not only those at an identical coordinate). Each cluster renders
    // as a single pin with a count badge; clicking it opens the group list.
    // Pins are pre-sorted by budget desc, so the cluster anchor/representative
    // is the most prominent project in that cluster.
    const clusters = clusterByProximity(
      sorted,
      zoom,
      (pin) => pin.position,
    )

    return clusters.map((cluster, idx) => {
      const group = cluster.items
      const top = group[0]
      const [lat, lng] = top.position
      return {
        key: `${lat.toFixed(5)},${lng.toFixed(5)}-${idx}`,
        entity: top.id,
        latitude: lat,
        longitude: lng,
        displayLat: lat,
        displayLng: lng,
        status: top.status,
        budgetNum: top.budgetNum,
        count: group.length,
        group,
      }
    })
  }, [lguPinState, queryName, selected, zoom, matchesStatusFilter, matchesVerificationFilter])

  return (
    <section className="w-full">
      <MapContainer
        bounds={BOUNDS}
        boundsOptions={{ padding: [8, 8] }}
        maxBounds={BOUNDS}
        maxBoundsViscosity={1}
        minZoom={8}
        maxZoom={16}
        zoomControl={false}
        attributionControl={false}
        scrollWheelZoom
        className="leaflet-container h-[80vh] min-h-96 w-full lg:h-[91vh]"
      >
        {municipalities && (
          <GeoJSON
            key={`munis-${selected?.name || spatialLocation || 'none'}`}
            data={municipalities}
            style={(feature) => ({
              className:
                (feature.properties.name === selected?.name &&
                selected?.kind === 'lgu') ||
                (spatialLocation &&
                  feature.properties.name.toLowerCase().includes(spatialLocation.toLowerCase()))
                  ? 'land land--selected'
                  : 'land',
              fillOpacity: 1,
            })}
            onEachFeature={(feature, layer) => {
              layer.on('click', (event) => {
                DomEvent.stopPropagation(event.originalEvent)
                selectLgu(feature)
              })
            }}
          />
        )}
        {municipalities?.features.map((feature) => (
          <Marker
            key={feature.properties.name}
            // GeoJSON is [lng, lat]; Leaflet markers expect [lat, lng].
            position={[feature.properties.label[1], feature.properties.label[0]]}
            icon={labelIcon(feature.properties.name)}
            interactive={false}
          />
        ))}
        <MapAutoResize />
        <MapLabels />
        <div className="map-controls-overlay absolute right-3 top-3 z-[1000]">
          <MapControls />
        </div>
        {/* Legend: bottom-center on phones (Ask-AI pill sits just above it);
            top-right (left of the zoom controls) on sm+ — same desktop layout. */}
        <div className="map-controls-overlay absolute inset-x-0 bottom-3 z-[1000] flex justify-center px-3 sm:inset-x-auto sm:bottom-auto sm:right-14 sm:top-3 sm:justify-end">
          <MapLegend />
        </div>
        <MapCamera target={selected} />
        <MapContextCameraController />
        <MapBackgroundClick
          onClear={() => {
            setSelected(null)
            clearSpatialData()
          }}
        />
        <ZoomWatcher onZoom={onZoom} />
        <BarangayLayer target={selected} visible={showDetail} zoom={zoom} />
        
        {/* Synchronized AI Copilot Spatial Dots */}
        {isSpatialActive
          ? displaySpatialDots.map((dot) => {
              const isHighlighted = highlightedProjectId === dot.id
              const bStr =
                dot.budget ||
                (dot.budget_numeric != null
                  ? `₱${(dot.budget_numeric / 1e6).toFixed(1)}M`
                  : '')
              return (
                <Marker
                  key={`spatial-${dot.id}`}
                  position={[dot.displayLat, dot.displayLng]}
                  icon={getSpatialPinIcon(dot.status, isHighlighted, verificationTone)}
                  alt={dot.id}
                  eventHandlers={{
                    click(event) {
                      DomEvent.stopPropagation(event.originalEvent)
                      setHighlightEntity(dot.id)
                      highlightProject(dot.id, [dot.latitude, dot.longitude])
                      openProjectDetail(dot.id)
                    },
                  }}
                >
                  <Tooltip
                    direction="top"
                    offset={[0, -8]}
                    opacity={1}
                    className="pin-label"
                  >
                    <strong>{dot.id}</strong>
                    {bStr ? ` · ${bStr}` : ''}
                    {dot.barangay ? ` · Brgy. ${dot.barangay}` : ''}
                    {dot.status ? ` · ${dot.status}` : ''}
                    {dot.report_count > 0 ? ` · 📣 ${dot.report_count} report${dot.report_count === 1 ? '' : 's'}` : ''}
                  </Tooltip>
                </Marker>
              )
            })
          : showProjectPins &&
            selectedProjects.map((project) => {
              const pct = parseStatus(project.status).pct
              const isHighlighted = highlightedProjectId === project.entity
              return (
                <Marker
                  key={project.entity}
                  position={[project.displayLat, project.displayLng]}
                  icon={getSpatialPinIcon(
                    project.status,
                    isHighlighted,
                    verificationTone,
                  )}
                  alt={project.entity}
                  eventHandlers={{
                    click(event) {
                      DomEvent.stopPropagation(event.originalEvent)
                      setIntelOpen(true)
                      if (project.count > 1) {
                        setCoordGroup({
                          key: project.key,
                          projects: project.group,
                        })
                      } else {
                        setHighlightEntity(project.entity)
                        highlightProject(project.entity, [project.latitude, project.longitude])
                        openProjectDetail(project.entity)
                      }
                    },
                  }}
                >
                  <Tooltip
                    direction="top"
                    offset={[0, -8]}
                    opacity={1}
                    className="pin-label"
                  >
                    {project.count > 1
                      ? `${project.count} projects · ${project.entity}+`
                      : project.entity}
                    {pct != null ? ` · ${pct}%` : ''}
                    {project.budgetNum != null
                      ? ` · ₱${(project.budgetNum / 1e6).toFixed(1)}M`
                      : ''}
                  </Tooltip>
                </Marker>
              )
            })}
        {intelOpen ? (
          <LocationIntelPanel
            key={selected ? `${selected.kind}:${selected.name}` : 'overview'}
            selected={selected}
            highlight={highlightEntity}
            onClose={() => setIntelOpen(false)}
            onReset={() => setSelected(null)}
            onSelectSite={selectSite}
            onSelectProject={openProjectDetail}
            onOpenFullDetails={() => {
              if (selected) setFullDetails(lguQuery(selected.name))
            }}
            locProjects={locProjects}
            locError={locError}
            mapPins={mapPins}
            municipalities={municipalities}
          />
        ) : (
          <button
            type="button"
            onClick={() => setIntelOpen(true)}
            className="absolute top-3 left-3 z-[1000] flex items-center gap-2 rounded-xl border border-white/15 bg-black/65 px-3 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-md transition hover:bg-black/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Location Intel
          </button>
        )}
      </MapContainer>
      <ProjectDetailModal
        entity={detailEntity}
        onClose={() => setDetailEntity(null)}
      />
      {fullDetails && (
        <FullDetailsModal
          key={fullDetails}
          locationName={fullDetails}
          onClose={() => setFullDetails(null)}
          onSelectProject={(entity) => {
            setFullDetails(null)
            openProjectDetail(entity)
          }}
        />
      )}
      {coordGroup && (
        <CoordGroupModal
          key={coordGroup.key}
          projects={coordGroup.projects}
          onClose={() => setCoordGroup(null)}
          onSelectProject={(id) => {
            setCoordGroup(null)
            setHighlightEntity(id)
            openProjectDetail(id)
          }}
        />
      )}
    </section>
  )
}

export default CebuMap
