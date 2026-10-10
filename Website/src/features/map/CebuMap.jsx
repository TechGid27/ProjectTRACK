import { useEffect, useMemo } from 'react'
import { divIcon } from 'leaflet'
import { GeoJSON, MapContainer, Marker, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import municipalities from '../../assets/cebuMunicipalities.json'
import { pins } from '../../data/pins'

const BOUNDS = [
  [9.32, 123.2],
  [11.45, 124.65],
]

const LABEL_MIN_ZOOM = 11

const CONTROL_BTN =
  'grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-black/65 text-white shadow-lg backdrop-blur-md transition hover:bg-black/85 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70'

function pinIcon(tone) {
  return divIcon({
    className: '',
    html: `<span class="pin${tone === 'default' ? '' : ` pin--${tone}`}"></span>`,
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
  const icons = useMemo(
    () => ({ default: pinIcon('default'), amber: pinIcon('amber') }),
    [],
  )

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
          style={() => ({ className: 'land', fillOpacity: 1 })}
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
        {pins.map((pin) => (
          <Marker
            key={pin.id}
            position={pin.position}
            icon={icons[pin.tone] ?? icons.default}
            alt={pin.name}
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
        ))}
        <MapAutoResize />
        <MapLabels />
        <MapControls />
      </MapContainer>
    </section>
  )
}

export default CebuMap
