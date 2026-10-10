import { useEffect, useState } from 'react'
import { GeoJSON, MapContainer, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import mask from '../../assets/cebuMask.json'

const BOUNDS = [
  [9.32, 123.18],
  [11.66, 124.7],
]

// The mask's holes are the Cebu islands themselves, so reusing them as a
// highlight layer keeps the boundary exactly in sync with the scrim.
const islands = {
  type: 'FeatureCollection',
  features: mask.geometry.coordinates.slice(1).map((ring) => ({
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [ring] },
  })),
}

const TILES = {
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
    labels:
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  },
  dark: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri &mdash; Sources: Esri, TomTom, Garmin, FAO, NOAA, USGS, OpenStreetMap contributors',
    labels:
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
  },
}

const CONTROL_BTN =
  'grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-black/65 text-white shadow-lg backdrop-blur-md transition hover:bg-black/85 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70'

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

function MapOverlays({ mode, onModeChange }) {
  const map = useMap()

  return (
    <>
      <div className="absolute left-3 top-3 z-[1000] flex gap-1 rounded-full border border-white/15 bg-black/60 p-1 shadow-lg backdrop-blur-md">
        {Object.keys(TILES).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onModeChange(key)}
            aria-pressed={mode === key}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${
              mode === key
                ? 'bg-white text-gray-a12 shadow'
                : 'text-white/70 hover:text-white'
            }`}
          >
            {key}
          </button>
        ))}
      </div>

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
    </>
  )
}

function CebuMap() {
  const [mode, setMode] = useState('satellite')

  const tiles = TILES[mode]

  return (
    <section className="w-full ">
      <MapContainer
        bounds={BOUNDS}
        boundsOptions={{ padding: [8, 8] }}
        maxBounds={BOUNDS}
        maxBoundsViscosity={1}
        minZoom={8}
        maxZoom={18}
        zoomControl={false}
        scrollWheelZoom
        className="leaflet-container h-[80vh] min-h-96 w-[160vh] lg:h-[91vh]"
      >
        <TileLayer key={mode} url={tiles.url} attribution={tiles.attribution} />
        {tiles.labels && (
          <TileLayer
            key={`${mode}-labels`}
            url={tiles.labels}
            attribution="Labels &copy; Esri"
          />
        )}
        <GeoJSON
          data={mask}
          interactive={false}
          style={() => ({ className: 'island-mask', fillOpacity: 1 })}
          attribution="Boundaries: &copy; OpenStreetMap contributors, GADM 4.1"
        />
        <GeoJSON
          data={islands}
          style={() => ({ className: 'island-area', fillOpacity: 1 })}
        />
        <MapAutoResize />
        <MapOverlays mode={mode} onModeChange={setMode} />
      </MapContainer>
    </section>
  )
}

export default CebuMap
