# ProjectTrack Web Platform

The web presentation tier of ProjectTrack provides an interactive, low-latency geospatial dashboard for monitoring DPWH civil works projects across the Province of Cebu, Philippines.

---

## Technical Stack

* **UI Framework**: [React 19](https://react.dev)
* **Build Tool**: [Vite 8](https://vite.dev)
* **Cartography & GIS**: [Leaflet](https://leafletjs.com) via [react-leaflet 5](https://react-leaflet.vercel.app)
* **Styling**: [Tailwind CSS 4](https://tailwindcss.com) (color palettes configured in `src/index.css`)
* **Linting**: ESLint (Flat Configuration)

---

## Key Capabilities

* **Vector Boundary Rendering**: Renders all 53 Local Government Units (LGUs) of Cebu Province (44 municipalities and 9 cities) as styled vector polygons without requiring external raster satellite tile services.
* **Barangay Zoom Intelligence**: Dynamic polygon rendering for barangay boundaries at high zoom levels (~Zoom 12+).
* **Project Status Markers**: Interactive spatial markers with detailed status, budget, and contractor inspection panels.
* **GraphRAG Client**: Connects to the backend REST and SSE endpoints for natural language question answering and instant Cypher search cards.
* **Resilient Offline / Mock Fallbacks**: Includes static GeoJSON fixtures and mock data providers in `src/data/mockApi.js` for standalone evaluation.

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
npm run build    # Compile production bundle to dist/
npm run preview  # Locally preview production build
```

---

## Spatial Data Sources

* `src/assets/cebuMunicipalities.json`: GeoJSON `FeatureCollection` covering the 53 LGUs of Cebu Province (mainland, Bantayan, Camotes, Mactan, Olango). Sourced from [geoBoundaries](https://www.geoboundaries.org) `PHL/ADM3` (gbOpen), based on NAMRIA/PSA data.
* `public/data/cebu-barangays.json`: High-resolution administrative polygon boundaries for all Cebu barangays.
* `src/data/pins.js`: Baseline project coordinates and status markers.

---

## 📁 Project Structure

This package is part of the ProjectTrack open-source monorepo, licensed under the MIT License.
