import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { divIcon, DomEvent } from 'leaflet'
import { GeoJSON, MapContainer, Marker, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import municipalities from '../../assets/cebuMunicipalities.json'
import { pins } from '../../data/pins'
import { lguQuery, mockProjectsByLocation, projectContractor } from '../../data/mockApi'
import { fetchProject, fetchProjectsByLocation } from '../../services/api'
import {
  BARANGAY_MIN_ZOOM,
  fetchOsmContextCached,
  featureCentroid,
} from '../../services/overpass'

const BOUNDS = [
  [9.32, 123.2],
  [11.45, 124.65],
]

const LABEL_MIN_ZOOM = 11

const CONTROL_BTN =
  'grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-black/65 text-white shadow-lg backdrop-blur-md transition hover:bg-black/85 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70'

function pinIcon(tone, selected) {
  return divIcon({
    className: '',
    html: `<span class="pin${tone === 'default' ? '' : ` pin--${tone}`}"${
      selected
        ? ' style="width:20px;height:20px;box-shadow:0 0 0 5px rgba(16,185,129,0.35);"'
        : ''
    }></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

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

const PROJECT_PIN_ICON = divIcon({
  className: '',
  html: '<span class="project-pin"></span>',
  iconSize: [13, 13],
  iconAnchor: [6, 6],
})

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

function MapCamera({ target }) {
  const map = useMap()

  useEffect(() => {
    if (!target) return
    if (target.kind === 'site') {
      map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 12), {
        duration: 0.9,
      })
    } else {
      map.panTo([target.lat, target.lng], { duration: 0.5 })
    }
  }, [map, target])

  return null
}

function MapBackgroundClick({ onClear }) {
  const map = useMap()

  useEffect(() => {
    const handler = (event) => {
      const target = event.originalEvent?.target
      if (
        target instanceof Element &&
        target.closest('.leaflet-interactive')
      ) {
        return
      }
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

const QUICK_ACTIONS = [
  {
    label: 'Export',
    icon: 'M7 3h6v4H7V3zm0 14h6v4H7v-4zM3 9h18v2H3V9zm0 4h18v2H3v-2z',
  },
  {
    label: 'Schedule',
    icon: 'M7 2v3M17 2v3M3 8h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z',
  },
  {
    label: 'Share',
    icon: 'M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7M16 6l-4-4-4 4M12 2v13',
  },
]

const STATUS_CLS = {
  Ongoing: 'bg-emerald-400/15 text-emerald-300',
  Completed: 'bg-sky-400/15 text-sky-300',
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
}) {
  const panelRef = useRef(null)
  const cardRefs = useRef({})
  const names = useMemo(
    () => municipalities.features.map((f) => f.properties.name),
    [],
  )
  const cityCount = useMemo(
    () => names.filter((n) => CITY_RE.test(n)).length,
    [names],
  )

  const nearbySites = useMemo(() => {
    if (!selected) return []
    const origin = [selected.lat, selected.lng]
    return pins
      .map((pin) => ({ ...pin, km: haversineKm(origin, pin.position) }))
      .filter((pin) => pin.name !== selected.name)
      .sort((a, b) => a.km - b.km)
      .slice(0, 4)
  }, [selected])

  const nearbyLgu = useMemo(() => {
    if (!selected || selected.kind !== 'site') return null
    let best = null
    for (const feature of municipalities.features) {
      if (feature.properties.name === selected.name) continue
      const [lng, lat] = feature.properties.label
      const km = haversineKm([selected.lat, selected.lng], [lat, lng])
      if (!best || km < best.km) best = { name: feature.properties.name, km }
    }
    return best
  }, [selected])

  const sitesNearbyLgu = useMemo(() => {
    if (!selected || selected.kind !== 'lgu') return null
    const feature = municipalities.features.find(
      (f) => f.properties.name === selected.name,
    )
    if (!feature) return null
    const [lng, lat] = feature.properties.label
    return pins.filter((pin) => haversineKm([lat, lng], pin.position) <= 30)
      .length
  }, [selected])

  const [locState, setLocState] = useState({ name: null, data: null })

  const queryName = selected ? lguQuery(selected.name) : null

  const locProjects =
    queryName && locState.name === queryName ? locState.data : null

  useEffect(() => {
    let cancelled = false
    if (!queryName) return undefined
    fetchProjectsByLocation(queryName).then((data) => {
      if (!cancelled) setLocState({ name: queryName, data })
    })
    return () => {
      cancelled = true
    }
  }, [queryName])

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

  useEffect(() => {
    if (!highlight) return
    cardRefs.current[highlight]?.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth',
    })
  }, [highlight])

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
      className="absolute top-3 left-3 z-[1000] flex max-h-[calc(100%-1.5rem)] w-[270px] flex-col overflow-y-auto rounded-2xl border border-white/10 bg-[#0c1418]/85 shadow-2xl backdrop-blur-md sm:w-[290px]"
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h3 className="text-sm font-bold text-white">Location Intel</h3>
        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Live Active
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
              ← Overview
            </button>
          )}
        </div>
        <p className="mt-1.5 font-serif text-xl font-bold text-white">
          {selected ? selected.name : 'Northern Cebu'}
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
              <IntelChip>{pins.length} Sites</IntelChip>
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
            <MetricCard label="Project sites" value={pins.length} />
            <MetricCard label="Cities" value={cityCount} />
            <MetricCard label="Municipalities" value={names.length - cityCount} />
          </div>
        )}
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
                        site.tone === 'amber' ? 'bg-amber-400' : 'bg-[#c4585f]'
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
          {!locProjects ? (
            <p className="mt-2 text-[11px] text-white/50">Loading projects…</p>
          ) : locProjects.projects.length === 0 ? (
            <p className="mt-2 text-[11px] text-white/50">
              No example project data for this location yet.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {locProjects.projects.map((project) => {
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
                            STATUS_CLS[project.status] ??
                            'bg-white/10 text-white/60'
                          }`}
                        >
                          {project.status}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-snug text-white/80">
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
      )}

      <div className="px-4 py-4">
        <p className="text-[10px] font-semibold tracking-widest text-white/40">
          QUICK ACTIONS
        </p>
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2 py-2.5 text-[10px] font-medium text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                aria-hidden="true"
              >
                <path d={action.icon} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {action.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={!locProjects?.projects?.length}
          onClick={() =>
            onSelectProject(highlight ?? locProjects.projects[0].entity)
          }
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
  const [formState, setFormState] = useState({
    id: null,
    show: false,
    picName: '',
    location: '',
    desc: '',
    error: '',
  })

  const report =
    reportState.id === entity
      ? reportState.value
      : entity
        ? readReport(entity)
        : null

  const form =
    formState.id === entity
      ? formState
      : { id: entity, show: false, picName: '', location: '', desc: '', error: '' }

  function openAnomalyForm() {
    setFormState({
      id: entity,
      show: true,
      picName: '',
      location: (detailState.id === entity ? detailState.data?.location : '') ?? '',
      desc: '',
      error: '',
    })
  }

  function patchForm(partial) {
    setFormState((prev) => ({
      ...(prev.id === entity
        ? prev
        : {
            id: entity,
            show: true,
            picName: '',
            location: '',
            desc: '',
            error: '',
          }),
      ...partial,
      id: entity,
    }))
  }

  function submitAnomaly(event) {
    event.preventDefault()
    if (!form.desc.trim()) {
      patchForm({ error: 'Add a short description of what you observed.' })
      return
    }
    const value = {
      type: 'anomaly',
      location: form.location.trim(),
      description: form.desc.trim(),
      pictureName: form.picName,
      at: new Date().toISOString(),
    }
    writeReport(entity, value)
    setReportState({ id: entity, value })
    setFormState((prev) => ({ ...prev, id: entity, show: false, error: '' }))
  }

  useEffect(() => {
    let cancelled = false
    if (!entity) return undefined
    fetchProject(entity).then((data) => {
      if (!cancelled) setDetailState({ id: entity, data })
    })
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
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Close project details"
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
      />
      <div className="relative z-10 max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#0c1418]/95 p-5 shadow-2xl backdrop-blur-md">
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
            <p className="mt-3 text-sm leading-relaxed text-white/85">
              {project.description}
            </p>
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
              {report ? (
                <p
                  role="status"
                  className="mt-2.5 rounded-lg bg-emerald-400/15 px-3 py-2 text-[11px] font-semibold text-emerald-300"
                >
                  Thank you — your anomaly report for this project was saved.
                </p>
              ) : form.show ? (
                <form
                  onSubmit={submitAnomaly}
                  className="mt-2.5 space-y-2.5"
                  noValidate
                >
                  <div>
                    <label
                      htmlFor="anomaly-picture"
                      className="block text-[10px] font-medium text-white/50"
                    >
                      Picture
                    </label>
                    <div className="mt-1 flex items-center gap-2 overflow-hidden">
                      <input
                        id="anomaly-picture"
                        type="file"
                        accept="image/*"
                        onChange={(event) =>
                          patchForm({
                            picName: event.target.files?.[0]?.name ?? '',
                          })
                        }
                        className="sr-only"
                      />
                      <label
                        htmlFor="anomaly-picture"
                        className="shrink-0 cursor-pointer rounded-lg bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/80 transition hover:bg-white/15"
                      >
                        Choose File
                      </label>
                      <span className="min-w-0 truncate text-[11px] text-white/60">
                        {form.picName || 'No file chosen'}
                      </span>
                    </div>
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
                      onChange={(event) =>
                        patchForm({ location: event.target.value })
                      }
                      placeholder="Barangay / street / landmark"
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-[11px] text-white placeholder:text-white/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
                    />
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
                      onChange={(event) =>
                        patchForm({
                          desc: event.target.value,
                          error: '',
                        })
                      }
                      placeholder="What did you observe?"
                      className="mt-1 w-full resize-none rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-[11px] text-white placeholder:text-white/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
                    />
                  </div>
                  {form.error && (
                    <p role="alert" className="text-[10px] text-red-300">
                      {form.error}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 rounded-xl bg-[#1f3d3c] px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-[#2a5452] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400/70"
                    >
                      Submit Report
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFormState((prev) => ({
                          ...prev,
                          id: entity,
                          show: false,
                          error: '',
                        }))
                      }
                      className="rounded-xl border border-white/10 px-3 py-2 text-[11px] font-semibold text-white/60 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={openAnomalyForm}
                  className="mt-2.5 w-full rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] font-semibold text-amber-300 transition hover:bg-amber-400/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400/70"
                >
                  Report Anomaly
                </button>
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
    </div>
  )
}

function MapControls() {
  const map = useMap()

  return (
    <div className="absolute right-3 top-3 z-[1000] flex flex-col gap-1.5">
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
  const [intelOpen, setIntelOpen] = useState(true)
  const [selected, setSelected] = useState(null)
  const [zoom, setZoom] = useState(8)
  const [highlightEntity, setHighlightEntity] = useState(null)
  const [detailEntity, setDetailEntity] = useState(null)

  const onZoom = useCallback((value) => setZoom(value), [])

  const icons = useMemo(
    () => ({
      default: pinIcon('default'),
      amber: pinIcon('amber'),
      defaultSelected: pinIcon('default', true),
      amberSelected: pinIcon('amber', true),
    }),
    [],
  )

  function selectSite(pin) {
    setHighlightEntity(null)
    setSelected({
      kind: 'site',
      name: pin.name,
      lat: pin.position[0],
      lng: pin.position[1],
    })
    setIntelOpen(true)
  }

  function selectLgu(feature) {
    const name = feature.properties.name
    if (selected?.kind === 'lgu' && selected.name === name) {
      setSelected(null)
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
  }

  const showDetail =
    zoom >= BARANGAY_MIN_ZOOM && selected?.kind === 'lgu'

  function openProjectDetail(entity) {
    if (!entity) return
    setHighlightEntity(entity)
    setDetailEntity(entity)
  }

  const selectedProjects = useMemo(() => {
    if (selected?.kind !== 'lgu') return []
    return mockProjectsByLocation(lguQuery(selected.name)).projects.filter(
      (project) => project.lat != null && project.lng != null,
    )
  }, [selected])

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
        <GeoJSON
          data={municipalities}
          style={(feature) => ({
            className:
              feature.properties.name === selected?.name &&
              selected?.kind === 'lgu'
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
        {municipalities.features.map((feature) => (
          <Marker
            key={feature.properties.name}
            // GeoJSON is [lng, lat]; Leaflet markers expect [lat, lng].
            position={[feature.properties.label[1], feature.properties.label[0]]}
            icon={labelIcon(feature.properties.name)}
            interactive={false}
          />
        ))}
        {pins.map((pin) => {
          const isSelected = selected?.kind === 'site' && selected.name === pin.name
          return (
            <Marker
              key={pin.id}
              position={pin.position}
              icon={
                isSelected
                  ? icons[`${pin.tone ?? 'default'}Selected`]
                  : icons[pin.tone] ?? icons.default
              }
              alt={pin.name}
              eventHandlers={{
                click(event) {
                  DomEvent.stopPropagation(event.originalEvent)
                  selectSite(pin)
                },
              }}
            >
              <Tooltip
                direction="top"
                offset={[0, -10]}
                opacity={1}
                className="pin-label"
              >
                {pin.name}
              </Tooltip>
            </Marker>
          )
        })}
        <MapAutoResize />
        <MapLabels />
        <MapControls />
        <MapCamera target={selected} />
        <MapBackgroundClick onClear={() => setSelected(null)} />
        <ZoomWatcher onZoom={onZoom} />
        <BarangayLayer target={selected} visible={showDetail} zoom={zoom} />
        {showDetail &&
          selectedProjects.map((project) => (
            <Marker
              key={project.entity}
              position={[project.lat, project.lng]}
              icon={PROJECT_PIN_ICON}
              alt={project.entity}
              eventHandlers={{
                click(event) {
                  DomEvent.stopPropagation(event.originalEvent)
                  setIntelOpen(true)
                  openProjectDetail(project.entity)
                },
              }}
            >
              <Tooltip
                direction="top"
                offset={[0, -8]}
                opacity={1}
                className="pin-label"
              >
                {project.entity} · {project.budget}
              </Tooltip>
            </Marker>
          ))}
        {intelOpen ? (
          <LocationIntelPanel
            key={selected ? `${selected.kind}:${selected.name}` : 'overview'}
            selected={selected}
            highlight={highlightEntity}
            onClose={() => setIntelOpen(false)}
            onReset={() => setSelected(null)}
            onSelectSite={selectSite}
            onSelectProject={openProjectDetail}
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
    </section>
  )
}

export default CebuMap
