# ProjectTRACK: DPWH Cebu Infrastructure Tracking & Intelligence System

**ProjectTRACK** is an intelligent civic infrastructure platform for tracking, analyzing, and querying **4,370+ DPWH civil works projects** across Cebu Province (2022 – Present).

Built with **Neo4j Aura (Knowledge Graph)**, **FastAPI (REST & SSE Streaming Backend)**, **Groq LPU Engine (`qwen/qwen3.8-27b`)**, **Interactive Geospatial Web GIS (React 19 + Leaflet)**, and **Multi-Tier Fallback Resilience**.

---

## 🏗️ System Architecture

```text
ProjectTRACK/
├── backend/                    # ⚡ Python FastAPI & GraphRAG Pipeline
│   ├── backend/                # FastAPI application, services, models, and tests
│   ├── pipeline/               # Knowledge graph sync, scraping & Cypher query engine
│   ├── main.py                 # Master CLI runner, interactive console, and local AI setup
│   ├── requirements.txt        # Python backend dependencies
│   └── Readme.md               # Backend documentation & installation guide
├── Website/                    # 🌐 React 19 + Vite + Leaflet Web Application
│   ├── src/                    # Interactive Cebu vector map, glowing pins, statistics
│   ├── package.json            # React 19 + Vite dependencies
│   └── README.md               # Frontend documentation & development guide
├── mobile/                     # 📱 Mobile application
│   └── Readme.md               # Mobile client architecture & roadmap
├── .gitignore                  # Monorepo git ignore rules (protecting .env & build caches)
└── README.md                   # Monorepo master documentation
```

---

## 🌟 Key Highlights

* **⚡ Sub-20ms Graph Queries**: Direct Cypher and full-text index searches across 4,370+ DPWH projects, contractors, budgets, and jurisdictions.
* **🛡️ 5-Layer Domain Guardrails**: Pre-retrieval intent classification that intercepts programming queries, generic trivia, and off-topic prompts in `<0.1ms`.
* **🤖 Multi-Tier Fallback Resilience (100% Uptime / Zero Crash)**:
  * **Tier 0**: Groq LPU engine running `qwen/qwen3.8-27b` at ~500+ tok/s.
  * **Tier 1**: Offline local AI fallback with `qwen2.5:0.5b` (~398 MB) via local Ollama.
  * **Tier 2**: Deterministic Graph Synthesizer (<5ms) directly from Neo4j when rate limits (HTTP 429) or network disruptions occur.
* **📦 1-Command Permission-Gated Local AI**: Run `python main.py --setup-local-ai` in `backend/` to configure local Ollama with explicit `[y/N]` confirmation.
* **📍 Geospatial Intelligence**: Full batch geocoding (`python main.py --geocode`) attaching verified WGS84 coordinates to Neo4j project and location nodes.
* **🗺️ Interactive Web GIS**: Real-time vector map of Cebu with zero tile server dependencies, rendering 53 LGU boundaries and glowing project pins.

---

## 📁 Repository Modules

| Module | Stack | Documentation | Description |
| :--- | :--- | :--- | :--- |
| **`backend/`** | Python 3.10+, FastAPI, Neo4j Aura, Groq | [Backend README](backend/Readme.md) | GraphRAG pipeline, REST & SSE API, Guardrails, CLI runner |
| **`Website/`** | React 19, Vite, Leaflet, Tailwind CSS 4 | [Website README](Website/README.md) | Vector-based interactive Cebu GIS map & project visualizer |
| **`mobile/`** | Mobile Companion (Upcoming) | [Mobile README](mobile/Readme.md) | Field-audit, citizen photo verification & offline GPS cache |

---

## 🚀 Quick Start Guide

### 1. Backend & Knowledge Graph Setup

Full setup instructions in [backend/Readme.md](backend/Readme.md).

```powershell
# Navigate to backend
cd backend

# Create & activate virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1    # On Linux/macOS: source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
Copy-Item .env.example .env    # Fill in NEO4J_URI, NEO4J_PASSWORD, GROQ_API_KEY

# Launch interactive CLI console
python main.py

# Or launch FastAPI REST & SSE server
python main.py --api
```

### 2. Web GIS Frontend Setup

Full setup instructions in [Website/README.md](Website/README.md).

```powershell
# Navigate to Website
cd Website

# Install Node dependencies
npm install

# Start local Vite development server
npm run dev
```

The web client runs locally at `http://localhost:5173`.

---

## 🔌 Backend API Reference

When the FastAPI server is running (`python main.py --api`), the following endpoints are available at `http://localhost:8000`:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health check for Neo4j Aura and LLM engines |
| `GET` | `/api/projects` | Paginated project search with keyword, LGU, and contractor filters |
| `GET` | `/api/projects/{id}` | Detailed project metadata, budget, contractor, and coordinates |
| `GET` | `/api/analytics/top-contractors` | Contractor leaderboard by awarded budget |
| `GET` | `/api/analytics/summary` | Global counts (projects, contractors, total budget) |
| `POST` | `/api/chat` | Domain-guarded grounded AI question answering |
| `GET` | `/api/chat/stream` | Server-Sent Events (SSE) streaming answers (~500+ tok/s) |

Interactive Swagger documentation is available at `http://localhost:8000/docs`.

---

## 🧪 Testing & Validation

### Automated Backend Test Suite
Run the 18 unit and integration tests covering API routes, guardrails, and multi-tier fallback resilience:

```powershell
cd backend
python -m unittest discover -s backend/tests -p "test_*.py"
```

### Frontend Code Quality
Validate React & Tailwind code formatting:

```powershell
cd Website
npm run lint
```

---

## 🛡️ Security & Privacy

* Sensitive API keys, database credentials, and service tokens are kept strictly in `.env` files and excluded via `.gitignore`.
* Never commit `.env` or production credentials to any repository branch. A template is provided in `backend/.env.example`.

---

## 📄 License
MIT License. Open-source for civic transparency and public infrastructure research.
