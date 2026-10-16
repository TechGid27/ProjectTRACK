# ProjectTRACK — Web GIS Frontend

An interactive geospatial intelligence interface for exploring **DPWH civil works infrastructure projects** across Cebu Province. 

Built with **React 19**, **Vite**, **Leaflet**, and **Tailwind CSS 4**, the web interface features a custom vector map of Cebu with zero external satellite tile dependencies, zoom-responsive administrative boundaries, and glowing project pins.

---

## 🌟 Key Features

* **🗺️ Flat Vector Geospatial Rendering**: Renders the complete province of Cebu as styled GeoJSON vector polygons over a deep-canvas water background, eliminating tile server latency.
* **📍 Glowing Project Pins**: Custom animated `divIcon` markers with status-based ambient glow highlighting infrastructure project sites.
* **🏷️ Zoom-Gated Municipality Labels**: Dynamic SVG text labels positioned at computed surface centroids across all 53 LGUs of Cebu, progressively visible upon zooming.
* **📊 LGU & Infrastructure Statistics**: Real-time KPI summary bar displaying active municipality counts, surveyed sites, and regional breakdown.
* **⚡ Seamless Backend Integration**: Built to interface with the ProjectTRACK FastAPI backend (`/api/projects`, `/api/analytics`, `/api/chat/stream`).

---

## 🛠️ Tech Stack

* **UI Framework**: [React 19](https://react.dev)
* **Build Tool**: [Vite 8](https://vite.dev)
* **Mapping Engine**: [Leaflet](https://leafletjs.com) via [react-leaflet 5](https://react-leaflet.vercel.app)
* **Styling**: [Tailwind CSS 4](https://tailwindcss.com) (theme variables inlined in `src/index.css`)
* **Linting**: ESLint (flat config)

---

## 🚀 Getting Started

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **npm**: v9.0.0 or higher

### Installation & Development
```bash
# Navigate to Website directory
cd Website

# Install dependencies
npm install

# Start development server (runs on http://localhost:5173)
npm run dev
```

### Production Build & Preview
```bash
# Build optimized production bundle
npm run build

# Preview production build locally
npm run preview

# Run linter
npm run lint
```

---

## 📁 Project Structure

```text
Website/
├── public/                 # Static assets (favicons, manifest)
├── src/
│   ├── app/                # Root App component and routing
│   ├── assets/             # GeoJSON boundary data
│   │   └── cebuMunicipalities.json # 53 LGU boundaries (NAMRIA/PSA via geoBoundaries)
│   ├── data/               # Static dataset & seed pins
│   │   ├── pins.js         # Site coordinates, tones, and project metadata
│   │   └── site.js         # Site configuration and branding
│   ├── features/
│   │   └── map/            # CebuMap vector rendering engine & controls
│   ├── layout/             # Header, Footer, and Navigation wrappers
│   ├── pages/              # Views (HomePage, Project Explorer)
│   ├── index.css           # Tailwind CSS 4 theme scales & custom pin keyframes
│   └── main.jsx            # Application entry point
├── package.json
└── vite.config.js
```

---

## 🗺️ Geospatial Dataset & Attributions

* **Administrative Boundaries**: `src/assets/cebuMunicipalities.json` contains 53 LGUs (44 municipalities + 9 component/HUC cities), clipped to the Cebu archipelago (mainland, Bantayan, Camotes, Mactan, Olango).
  * **Source**: [geoBoundaries](https://www.geoboundaries.org) `PHL/ADM3` (gbOpen), simplified from NAMRIA / PSA open data under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
* **Project Pins**: Seeded in `src/data/pins.js` with `{ id, name, position: [lat, lng], tone }`, populated from DPWH civil works registry and geocoded locations.

---

## 📄 License

See [LICENSE](LICENSE). Part of the ProjectTRACK open-source civic initiative.
