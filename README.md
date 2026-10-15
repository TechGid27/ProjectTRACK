# ProjectTRACK: DPWH Cebu Infrastructure Tracking & Intelligence System

**ProjectTRACK** is an intelligent civic infrastructure platform for tracking, analyzing, and querying **4,370+ DPWH civil works projects** across Cebu Province (2022 – Present).

Built with **Neo4j Aura (Knowledge Graph)**, **FastAPI (REST & SSE Streaming Backend)**, **Groq LPU Engine (`qwen/qwen3.8-27b`)**, **Interactive Geospatial Web GIS (React 19 + Leaflet)**, and **Multi-Tier Fallback Resilience**.

---

## 🏗️ System Architecture

```text
ProjectTRACK/
├── backend/                    # ⚡ Python FastAPI & GraphRAG Pipeline
│   ├── backend/                # FastAPI application, services, and REST/SSE endpoints
│   ├── pipeline/               # Knowledge graph sync, scraping & Cypher query engine
│   ├── main.py                 # Master CLI runner, interactive console, and local AI setup
│   └── Readme.md               # Backend documentation & installation guide
├── Website/                    # 🌐 React 19 + Vite + Leaflet Web Application
│   ├── src/                    # Interactive Cebu map, glowing project pins, filter panels
│   └── package.json            # React + Vite dependencies
└── mobile/                     # 📱 Mobile application
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
* **🗺️ Interactive Map GIS**: Real-time geospatial mapping of infrastructure works in Cebu with status color legends and project details.

---

## 🚀 Getting Started

### Backend & AI Pipeline
See the detailed setup and running guide in [`backend/Readme.md`](file:///C:/Users/User/VSCode_Programming/track/ProjectTRACK/backend/Readme.md).

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py
```

### Web GIS Frontend
See the setup guide in [`Website/`](file:///C:/Users/User/VSCode_Programming/track/ProjectTRACK/Website).

```powershell
cd Website
npm install
npm run dev
```

---

## 🧪 Testing

Run the automated backend test suite (18 unit & integration tests):

```powershell
cd backend
python -m unittest discover -s backend/tests -p "test_*.py"
```

---

## 📄 License
MIT License. Open-source for civic infrastructure transparency and public research.
