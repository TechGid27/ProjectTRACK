# ProjectTrack Web Platform

The web presentation tier of ProjectTrack provides an interactive, low-latency geospatial dashboard for monitoring DPWH civil works projects. The map covers the whole Philippines (all provinces and highly-urbanized cities), while the project database currently carries DPWH records for the Province of Cebu.

---

## Technical Stack

* **UI Framework**: [React 19](https://react.dev)
* **Build Tool**: [Vite 8](https://vite.dev)
* **Routing**: History API pathname routing (`src/app/router.js`)
* **Cartography & GIS**: [Leaflet](https://leafletjs.com) via [react-leaflet 5](https://react-leaflet.vercel.app)
* **Styling**: [Tailwind CSS 4](https://tailwindcss.com) (color palettes configured in `src/index.css`)
* **Testing**: [Vitest](https://vitest.dev) + Testing Library
* **Linting**: ESLint (Flat Configuration)

---

## Key Capabilities

* **Nationwide Vector Boundary Rendering**: Renders all 87 provinces and highly-urbanized cities (HUCs) of the Philippines as styled vector polygons without requiring external raster satellite tile services. The viewport opens on the whole archipelago and stays clamped to Philippine bounds.
* **Province → Municipality Drill-Down**: Clicking a province (on the map or from the province browser) immediately draws its cities and municipalities as selectable outlines — every province has its own boundary file (`public/data/lgus/<slug>.json`, geoBoundaries `PHL/ADM3`), so only the focused province is fetched. Clicking an LGU selects it and loads its projects.
* **Collision-Free Map Labels**: Province and municipality names are placed greedily in priority order (selected place → LGUs → provinces by land area); anything that would overlap an already-placed label is hidden until the visitor zooms in, so the national overview never turns into a label soup. Metro Manila's four districts collapse into a single "Metro Manila" label below zoom 9, and a layered white halo keeps the dark text readable over land and water.
* **Cebu Barangay Zoom Intelligence**: Dynamic polygon rendering for Cebu barangay boundaries at high zoom levels (~Zoom 12+) when a Cebu city/municipality is selected (the barangay dataset is Cebu-keyed).
* **Project Status Markers**: Teal diamonds for ongoing projects (with completion %), blue diamonds for completed.
* **Proximity Marker Clustering**: Projects that overlap on screen are clustered by a zoom-aware pixel distance (`src/features/map/cluster.js`), not just by identical coordinates. Clusters collapse to one pin with a count and a nearby-projects list, and separate again as you zoom in.
* **Light / Dark Theme**: A header sun/moon toggle switches the whole interface between light and dark, persisted to `localStorage` and defaulting to the visitor's system preference (`src/services/theme.js`). The brand wordmark renders as a tri-color "ProjectTrack" (logo-toned "Project" + green "Track").
* **"Get an App" Header Download**: Centered navigation control providing turnkey access to the standalone Android APK (via `VITE_APK_URL`) with seamless fallback to GitHub Releases.
* **Two-Stage Resilient Geolocation**: Browser GPS engine with a rapid high-accuracy pass followed by a coarse cache-tolerant Wi-Fi/IP fallback, accompanied by actionable failure reason codes and in-place retry controls.
* **Location Intel Panel**: Per-province project list with statuses, budgets, and paginated full-details modal; clicking a province flies the camera to it and loads its projects.
* **Contractor Rankings**: `/contractors` page ranking contractors by awarded budget.
* **Auth**: Email/password and OAuth sign-in via the backend (`src/services/auth.js`); session-aware header with avatar menu.
* **Field Report Verification**: Authenticated anomaly reporting from any project (`ReportAnomalyModal` in `src/features/map/PhilippinesMap.jsx`). Attaches browser geolocation (lower-trust; re-validated server-side), enforces the backend's minimum description length (10 characters) client-side, handles sign-in (401) and the 3-per-day limit (429), and renders the backend verification verdict — status, distance from site, image-forensics result, reporter reputation, and timestamp — via `VerificationBadges`.
* **GraphRAG Chat with Memory ("ProjectTrack Watchdog")**: Floating chat assistant streaming from the backend SSE endpoint (non-streaming fallback). Answers are framed around the WHAT / WHERE / WHO / WHEN / WHY / HOW of a project from grounded facts, with no server-side vendor identifiers surfaced in the UI. Context-aware follow-ups ("tell me more about it", "what about in Cordova?") keep the prior topic.
* **Chat-Synchronized Map**: Chat answers drive the map camera - location questions fly to the LGU, while singular/superlative follow-ups ("what's the most expensive one?", "where is it located?", "most reported in Cordova?") zoom to that one project and highlight its pin. Clicking any pin highlights it too.
* **Verified Anomaly Reporting**: The report modal captures browser GPS on submit (`src/services/geolocation.js`, non-blocking — denial/timeout degrades gracefully) and sends it to the backend geofence; the project detail panel lists **all** community reports newest-first in a responsive two-column grid (one column on narrow mobile), each with its verification badge (colored diamond + "On-Site Verified" / "Unverified" / "Photo Flagged"), distance, timestamp, description, and photo — topped by an aggregate summary line (e.g. "4 reports · 3 On-Site Verified · 1 Photo Flagged") and filter chips + pagination so on-site consensus against official status is visible at a glance (`src/features/map/PhilippinesMap.jsx`). Verification uses a violet/rose/white palette distinct from the amber/emerald/cyan project-status hues, and the **Project Map Legend** shows an interactive "Report Verification" filter — On-Site Verified, Photo Flagged, and **All Anomalies** (every project carrying any citizen report) — each rendered as a colored diamond + label pill, the same visual language as the status filter symbols.

---

## Local Development

### 1. Installation
```bash
# Navigate to Website directory
cd Website

# Install dependencies
npm install
```

### 2. Environment Configuration
Copy the sample environment file:
```bash
cp .env.example .env
```
Ensure `VITE_API_URL` points to your backend instance (default: `http://localhost:8000`).

### 3. Execution Commands
```bash
npm run dev      # Launch Vite development server (http://localhost:5173)
npm run lint     # Run ESLint validation
npm run test     # Run Vitest suite
npm run build    # Compile production bundle to dist/
npm run preview  # Locally preview production build
```

---

## Spatial Data Sources

* `public/data/phProvinces.json`: GeoJSON `FeatureCollection` covering the 87 provinces and highly-urbanized cities of the Philippines (ADM2). Sourced from [geoBoundaries](https://www.geoboundaries.org) `PHL/ADM2` (gbOpen), based on NAMRIA/PSA data, then quantized to 4 decimal places (~11 m) for a smaller payload. Lazy-loaded at runtime to keep the initial bundle small.
* `src/data/phProvinceNames.js`: Lightweight list of the 87 province / HUC names used for text sections and the province browser grid. Keep it in sync with the `name` property of `phProvinces.json`.
* `public/data/lgus/<slug>.json`: One file per province (86 files — Cebu is excluded, see below) holding that province's cities and municipalities (geoBoundaries `PHL/ADM3`, quantized to 4 decimals, each feature carrying `{name, label, province}`). The file name is the province name slugified by `lguSlug()` in `src/features/map/PhilippinesMap.jsx`, so clicking a province fetches only its own outlines (≈4 KB–110 KB) through `loadProvinceLgus()`.
* `public/data/cebuMunicipalities.json`: GeoJSON `FeatureCollection` covering the 53 LGUs of Cebu Province (mainland, Bantayan, Camotes, Mactan, Olango). It is the Cebu entry of the LGU set above (`loadProvinceLgus('Cebu')` reads this file) **and** the source for barangay-level detail when a Cebu city/municipality is selected — the same file `backend/pipeline/lgu_boundaries.py` reverse-geocodes against, so map polygons and project municipality labels stay identical.
* `public/data/cebu-barangays.json`: Cebu barangay boundaries keyed by municipality/city, rendered only while a Cebu city/municipality is selected.
* `src/data/cebuLguNames.js`: Lightweight list of the 53 Cebu LGU names.
* `src/services/overpass.js`: Barangay and OSM context helpers (timeout, retry, failure cooldown).

---

## Project Structure

This package is part of the ProjectTrack open-source monorepo, licensed under the MIT License.

---

## Contributing

See the root [CONTRIBUTING.md](../CONTRIBUTING.md) for branching strategy, commit conventions, and pull request guidelines.
