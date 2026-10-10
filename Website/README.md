# Reyal Or Pake — Cebu Map

An interactive map of Cebu, Philippines. No basemap tiles: the province is
drawn as styled vector polygons over a flat "water" background, with glowing
pins for project sites.

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

`src/assets/cebuMunicipalities.json` is a GeoJSON `FeatureCollection` of the
53 LGUs of Cebu Province (44 municipalities + 9 component/HUC cities), clipped
to the Cebu islands (mainland, Bantayan, Camotes, Mactan, Olango).

- Source: [geoBoundaries](https://www.geoboundaries.org) `PHL/ADM3` (gbOpen,
  simplified), from NAMRIA/PSA data — [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- Original `cebuMask.json` (GADM 4.1 + OSM coastline scrim) was dropped when
  the map moved off satellite tiles; it is still in git history

Pins live in `src/data/pins.js` — `{ id, name, position: [lat, lng], tone }`
where `tone` is `default` (maroon) or `amber`.

## License

See [LICENSE](LICENSE).
