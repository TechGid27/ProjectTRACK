# DPWH Cebu Infrastructure FastAPI Backend

High-performance, production-ready Python **FastAPI** backend for the DPWH Cebu Infrastructure Knowledge Graph, Analytics, and GraphRAG Question Answering System.

Powered by **Neo4j Aura**, **Groq LPU Engine (`qwen/qwen3.8-27b`)**, and **Multi-Tier Fallback Resilience** (`Groq -> Local Ollama qwen2.5:0.5b -> Deterministic Graph Synthesizer`).

---

## Key Features

* **⚡ Sub-20ms Graph Traversal**: Query 4,370+ DPWH civil works projects, contractors, and budgets directly from Neo4j Aura.
* **🛡️ 5-Layer Domain Guardrails**: Sub-millisecond pre-retrieval intent classifier that blocks code requests, generic trivia, persona overrides, and off-domain queries before touching Neo4j or the LLM.
* **🤖 Multi-Tier Fallback Resilience**:
  * **Groq LPU**: Primary high-speed cloud generation at ~500+ tok/s.
  * **Local Ollama Fallback**: Lightweight `qwen2.5:0.5b` (~398 MB) offline fallback via `python main.py --setup-local-ai`.
  * **Deterministic Graph Synthesizer**: Sub-5ms zero-token factual synthesizer ensuring zero failures on rate limits (HTTP 429).
* **⚡ Instant Cypher Mode**: Retrieve project cards, analytics, and municipality summaries in `<10ms` without waiting for LLM generation.
* **🌊 Real-Time SSE Token Streaming**: Server-Sent Events (`/api/chat/stream`) for streaming token-by-token responses to web chat interfaces.
* **Conversational Memory & Spatial Targeting**: Follow-ups remember the prior location or project; a sandboxed, whitelist-validated LLM reference resolver handles ambiguous phrasing while staying DB-locked and injection-safe. Chat answers carry map coordinates that fly to an LGU or zoom to a single project.
* **📊 Graph Analytics**: Contractor leaderboards, project rankings, and total budget aggregations.
* **🔄 Asynchronous Pipeline Operations**: Background task tracking for Supabase-to-Neo4j syncing and Apify scraping.
* **🩺 Resilient Health Diagnostics**: Comprehensive monitoring of Neo4j Aura and LLM availability with graceful degradation reporting.

---

## Backend Architecture

```text
backend/
├── main.py                  # FastAPI app factory, CORS, routers & lifespan
├── config.py                # Typed settings via Pydantic Settings & .env
├── run.py                   # Development server CLI runner
├── setup_local_ai.py        # Permission-gated 1-command installer for local Ollama & qwen2.5:0.5b
├── requirements.txt         # FastAPI backend dependencies
├── README.md                # Documentation & API reference
├── API_JSON_EXAMPLES.md     # Copy-pasteable JSON request/response examples
├── api/                     # Modular API endpoints
│   ├── __init__.py
│   ├── router.py            # Unified API router (/api)
│   ├── health.py            # /api/health, /api/health/neo4j, /api/health/llm
│   ├── projects.py          # /api/projects/{id}, /api/projects/search, /api/projects/by-location
│   ├── analytics.py         # /api/analytics/summary, /api/analytics/top-contractors, /api/analytics/top-projects
│   ├── chat.py              # /api/chat (JSON), /api/chat/stream (SSE streaming)
│   └── pipeline.py          # /api/pipeline/sync, /api/pipeline/scrape, /api/pipeline/jobs
├── models/                  # Pydantic validation & response schemas
│   ├── __init__.py
│   ├── common.py            # Standard responses & health models
│   ├── project.py           # Project detail, search result, location response
│   ├── analytics.py         # Contractor leaderboard, dataset metrics
│   ├── chat.py              # Chat request/response, guardrail status
│   └── pipeline.py          # Background jobs & status tracking
├── services/                # Business logic & database adapters
│   ├── __init__.py
│   ├── neo4j_service.py     # Connection pool & Cypher queries
│   ├── guardrail_service.py # Pre-retrieval classifier & stream rail
│   ├── llm_service.py       # Multi-tier LLM execution (Groq -> Ollama -> Synthesizer)
│   ├── graph_synthesizer.py # Deterministic Graph Synthesizer (<5ms)
│   └── pipeline_service.py  # Background job execution & state tracker
└── tests/                   # Test suite (38 unit & integration tests)
    ├── __init__.py
    ├── test_api.py          # API endpoints & guardrails tests (33 tests)
    └── test_fallback.py     # Fallback resilience & synthesizer tests (5 tests)
```

---

## Quickstart

### 1. Install Dependencies

From the repository root or `backend/` directory:

```bash
pip install -r backend/requirements.txt
```

### 2. Configure Environment Variables

The backend automatically reads from your `.env` file in the project root or backend directory:

```env
# Neo4j Database
NEO4J_URI="neo4j+s://your-instance.databases.neo4j.io"
NEO4J_USERNAME="neo4j"
NEO4J_PASSWORD="your-password"

# Groq LPU Configuration (Fast API / Free Tier: https://console.groq.com/keys)
LLM_BASE_URL="https://api.groq.com/openai/v1"
LLM_MODEL="qwen/qwen3.8-27b"
GROQ_API_KEY="gsk_your_groq_api_key"
LLM_MAX_TOKENS=2048

# Supabase & Apify (Optional: only needed for scraping and syncing)
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_KEY="your-key"
APIFY_TOKEN="your-apify-token"
```

### 3. Run the Backend Server

Start the development server with auto-reload:

```bash
# Option A: Using the convenience runner
python backend/run.py

# Option B: Using Uvicorn directly
python -m uvicorn backend.main:create_app --factory --reload --host 0.0.0.0 --port 8000
```

Once running:
* **Interactive Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
* **ReDoc Documentation**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
* **API Root**: [http://localhost:8000/](http://localhost:8000/)

---

## Running Tests

Run the full automated test suite (38 unit & integration tests):

```bash
python -m unittest discover -s backend/tests -p "test_*.py"
```

The test suite validates:
- **Pre-retrieval guardrails**: Blocking off-topic prompts in `<0.1ms`.
- **Infrastructure domain queries**: Accurate project extraction and routing.
- **Project lookups**: Exact project ID retrieval and 404 handling.
- **Analytics & rankings**: Top contractor budget aggregation and project rankings.
- **SSE Streaming**: Token streaming with fallback.
- **Fallback resilience**: Groq 429 rate limit automatic cascade to Instant Graph Synthesizer.
- **Installer safety**: Permission gating `[y/N]` prompt in `setup_local_ai`.
- **System health**: Multi-service diagnostics across Neo4j and LLM endpoints.

---

## API Reference and Endpoints

### Health and Diagnostics

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Comprehensive system health across Neo4j and LLM |
| `GET` | `/api/health/neo4j` | Neo4j Aura ping and latency (ms) |
| `GET` | `/api/health/llm` | LLM model status, latency, and fallback state |

---

### Projects

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/projects/{project_id}` | Look up DPWH project by ID (e.g. `24HH0043`) |
| `GET` | `/api/projects/search?q=...` | Full-text search across projects, contractors, locations |
| `GET` | `/api/projects/by-location?location=...` | Aggregate projects, total count & budget for a municipality |

> Location matching is exact and canonicalized: `Cebu City`, `City of Bogo`/`Bogo City`, and hyphenated names like `Lapu-Lapu City` resolve to a single LGU without cross-LGU leakage.

---

### Analytics

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/analytics/summary` | Overall dataset metrics (total projects, total budget, contractors) |
| `GET` | `/api/analytics/top-contractors?limit=10` | Ranked contractors by cumulative awarded budget |
| `GET` | `/api/analytics/top-projects?limit=10` | Most expensive DPWH infrastructure projects in Cebu |

---

### Chat and GraphRAG QA

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/chat` | Grounded GraphRAG conversational QA (Standard JSON) |
| `POST` | `/api/chat/stream` | Real-time Server-Sent Events (SSE) token streaming |

#### Request Payload:
```json
{
  "message": "Any flood control projects in Bogo?",
  "history": [],
  "mode": "ai"
}
```

* `mode="ai"`: Graph retrieval + Groq / Local Ollama / Deterministic Synthesizer.
* `mode="instant"`: Instant Cypher lookup (`<10ms`, zero AI latency).

---

### ⚙️ Pipeline Administration

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/pipeline/sync` | Trigger Supabase to Neo4j Aura sync in background task |
| `POST` | `/api/pipeline/scrape` | Trigger Apify DPWH portal web scraper in background task |
| `GET` | `/api/pipeline/jobs` | List recent background jobs |
| `GET` | `/api/pipeline/jobs/{job_id}` | Check status and logs of a specific background task |

---

## License

MIT License. Designed for DPWH civil engineering data transparency and infrastructure analytics.
