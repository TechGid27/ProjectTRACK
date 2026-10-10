# Reyal Or Pake — Cebu Map

An interactive satellite map of Cebu, Philippines. The province boundary is
highlighted over a dark scrim so the island reads clearly against the imagery.

## Stack

- [React 19](https://react.dev) + [Vite 8](https://vite.dev)
- [Leaflet](https://leafletjs.com) via [react-leaflet 5](https://react-leaflet.vercel.app)
- [Tailwind CSS 4](https://tailwindcss.com) (colour scales are inlined in `src/index.css`)
- ESLint (flat config)

## Develop

```bash
npm install
npm run dev      # start dev server
npm run lint     # eslint
npm run build    # production build
npm run preview  # preview the build
```

## Map data

`src/assets/cebuMask.json` is a GeoJSON `Polygon`:

- `coordinates[0]` — exterior ring (the scrim extent)
- `coordinates[1..]` — one hole per Cebu island; the same holes are reused as
  the highlight layer in `src/features/map/CebuMap.jsx`, so the scrim and the
  outline can never drift apart

Boundaries come from [GADM 4.1](https://gadm.org) and the coastline is refined
with [OpenStreetMap](https://www.openstreetmap.org/copyright) `natural=coastline`
data (including the SRP and Talisay reclamation edges).

## License

See [LICENSE](LICENSE).
