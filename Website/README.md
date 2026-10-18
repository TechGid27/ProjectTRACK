# ProjectTrack Web Platform

The web presentation tier of ProjectTrack provides an interactive, low-latency geospatial dashboard for monitoring DPWH civil works projects across the Province of Cebu, Philippines.

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

* **Vector Boundary Rendering**: Renders all 53 Local Government Units (LGUs) of Cebu Province (44 municipalities and 9 cities) as styled vector polygons without requiring external raster satellite tile services.
* **Barangay Zoom Intelligence**: Dynamic polygon rendering for barangay boundaries at high zoom levels (~Zoom 12+).
* **Project Status Markers**: Teal diamonds for ongoing projects (with completion %), blue diamonds for completed. Shared coordinates open a group list.
* **Location Intel Panel**: Per-LGU project list with statuses, budgets, and paginated full-details modal.
* **Contractor Rankings**: `/contractors` page ranking contractors by awarded budget.
* **Auth**: Email/password and OAuth sign-in via the backend (`src/services/auth.js`); session-aware header with avatar menu.
* **GraphRAG Chat**: Floating chat assistant (`src/features/chat/ChatBot.jsx`) streaming from the backend SSE endpoint with non-streaming fallback.

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

* `public/data/cebuMunicipalities.json`: GeoJSON `FeatureCollection` covering the 53 LGUs of Cebu Province (mainland, Bantayan, Camotes, Mactan, Olango). Sourced from [geoBoundaries](https://www.geoboundaries.org) `PHL/ADM3` (gbOpen), based on NAMRIA/PSA data. Lazy-loaded at runtime to keep the initial bundle small.
* `src/data/cebuLguNames.js`: Lightweight list of the 53 LGU names used for text sections and the municipality browser grid.
* `src/services/overpass.js`: Barangay boundaries fetched from Overpass mirrors with timeout, retry, and failure cooldown.

---

## 📁 Project Structure

This package is part of the ProjectTrack open-source monorepo, licensed under the MIT License.
