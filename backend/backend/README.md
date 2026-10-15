# DPWH Cebu Infrastructure FastAPI Backend

High-performance, production-ready Python **FastAPI** backend for the DPWH Cebu Infrastructure Knowledge Graph, Analytics, and GraphRAG Question Answering System.

---

## 🌟 Key Features

* **⚡ Sub-20ms Graph Traversal**: Query 4,370+ DPWH civil works projects, contractors, and budgets directly from Neo4j Aura.
* **🛡️ 5-Layer Domain Guardrails**: Sub-millisecond pre-retrieval intent classifier that blocks code requests, generic trivia, persona overrides, and off-domain queries before touching Neo4j or the LLM.
* **⚡ Instant Cypher Mode**: Retrieve project cards, analytics, and municipality summaries in `<10ms` without waiting for LLM generation.
* **🌊 Real-Time SSE Token Streaming**: Server-Sent Events (`/api/chat/stream`) for streaming token-by-token responses to web chat interfaces.
* **📊 Graph Analytics**: Contractor leaderboards, project rankings, and total budget aggregations.
* **🔄 Asynchronous Pipeline Operations**: Background task tracking for Supabase-to-Neo4j syncing and Apify scraping.
* **🩺 Resilient Health Diagnostics**: Comprehensive monitoring of Neo4j Aura and Ollama LLM availability with graceful degradation.

---

## 📁 Backend Architecture

```text
backend/
├── main.py                  # FastAPI app factory, CORS, routers & lifespan
├── config.py                # Typed settings via Pydantic Settings & .env
├── run.py                   # Development server CLI runner
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
│   ├── llm_service.py       # Ollama & OpenAI streaming / token budgeting
│   └── pipeline_service.py  # Background job execution & state tracker
└── tests/                   # Test suite (11 unit & integration tests)
    ├── __init__.py
    └── test_api.py          # Unit & integration test cases
```

---

## 🚀 Quickstart

### 1. Install Dependencies

From the repository root or `backend/` directory:

```bash
pip install -r backend/requirements.txt
```

### 2. Configure Environment Variables

The backend automatically reads from your `.env` file in the project root:

```env
# Neo4j Database
NEO4J_URI="neo4j+s://your-instance.databases.neo4j.io"
NEO4J_USERNAME="neo4j"
NEO4J_PASSWORD="your-password"

# Xiaomi MiMo-V2-Flash Configuration (Free API / Unlimited Tokens)
# Hugging Face: https://huggingface.co/XiaomiMiMo/MiMo-V2-Flash
LLM_BASE_URL="https://router.huggingface.co/v1"
LLM_MODEL="XiaomiMiMo/MiMo-V2-Flash"
LLM_API_KEY="hf_your_free_token"  # Get free token from https://huggingface.co/settings/tokens
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
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Once running:
* **Interactive Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
* **ReDoc Documentation**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
* **API Root**: [http://localhost:8000/](http://localhost:8000/)

---

## 🧪 Running Tests

Run the test suite using Python's built-in `unittest` runner:

```bash
python backend/tests/test_api.py
```

All 11 unit and integration tests validate:
- Pre-retrieval guardrails (blocking off-topic prompts)
- On-topic infrastructure questions
- Exact project ID lookups
- Analytics and dataset aggregations
- Server-Sent Events (SSE) streaming responses
- Background job tracking
- Health diagnostics

---

## 📡 API Reference & Endpoints

### 🩺 Health & Diagnostics

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Comprehensive system health across Neo4j and Ollama |
| `GET` | `/api/health/neo4j` | Neo4j Aura ping and latency (ms) |
| `GET` | `/api/health/llm` | Ollama model status and latency |

---

### 🏗️ Projects

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/projects/{project_id}` | Look up DPWH project by ID (e.g. `24HH0043`) |
| `GET` | `/api/projects/search?q=...` | Full-text search across projects, contractors, locations |
| `GET` | `/api/projects/by-location?location=...` | Aggregate projects, total count & budget for a municipality |

#### Example: Search Projects by Location
```bash
curl -X GET "http://localhost:8000/api/projects/by-location?location=Bogo&limit=5"
```

Response:
```json
{
  "location": "Bogo",
  "total_count": 87,
  "total_budget": 1425000000.0,
  "total_budget_formatted": "₱ 1.43B",
  "showing_count": 5,
  "projects": [
    {
      "entity": "24HD0012",
      "labels": ["Project"],
      "description": "Construction of Flood Mitigation Structure along Bogo River",
      "budget": "₱ 49,000,000.00",
      "budget_num": 49000000.0,
      "status": "Ongoing"
    }
  ]
}
```

---

### 📊 Analytics

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/analytics/summary` | Overall dataset metrics (total projects, total budget, contractors) |
| `GET` | `/api/analytics/top-contractors?limit=10` | Ranked contractors by cumulative awarded budget |
| `GET` | `/api/analytics/top-projects?limit=10` | Most expensive DPWH infrastructure projects in Cebu |

#### Example: Top Contractors
```bash
curl -X GET "http://localhost:8000/api/analytics/top-contractors?limit=3"
```

Response:
```json
[
  {
    "contractor": "QM BUILDERS",
    "code": "7494",
    "project_count": 142,
    "total_budget": 5890000000.0,
    "total_budget_formatted": "₱ 5.89B"
  }
]
```

---

### 💬 Chat & GraphRAG QA

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

* `mode="ai"`: Graph retrieval + local Ollama / Cloud LLM summary.
* `mode="instant"`: Instant Cypher lookup (`<10ms`, zero AI latency).

#### Off-Domain Guardrail Example:
```bash
curl -X POST "http://localhost:8000/api/chat" \
     -H "Content-Type: application/json" \
     -d '{"message": "Write a python script for binary search"}'
```

Response:
```json
{
  "answer": "Out of Scope: Programming and software code generation queries are outside system scope.\nThis assistant is strictly restricted to DPWH Cebu infrastructure projects, contractors, budgets, and locations.",
  "graph_context": "",
  "project_card": null,
  "matched_projects_count": 0,
  "guardrail": {
    "is_off_topic": true,
    "reason": "Programming and software code generation queries are outside system scope.",
    "matched_rule": "programming_intent"
  },
  "mode": "ai",
  "duration_ms": 0.4,
  "model": null
}
```

---

### 🌊 Frontend SSE Streaming Example (JavaScript / TypeScript)

You can consume `/api/chat/stream` in modern frontends (React / Next.js / Vue):

```typescript
async function askStream(question: string) {
  const response = await fetch("http://localhost:8000/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: question, mode: "ai" }),
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split("\n");

    for (const line of lines) {
      if (line.startsWith("event: token")) {
        // Next line contains: data: {"token": "..."}
      } else if (line.startsWith("data: ")) {
        const data = JSON.parse(line.slice(6));
        if (data.token) {
          process.stdout.write(data.token);
        }
      }
    }
  }
}
```

---

### ⚙️ Pipeline Administration

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/pipeline/sync` | Trigger Supabase to Neo4j Aura sync in background task |
| `POST` | `/api/pipeline/scrape` | Trigger Apify DPWH portal web scraper in background task |
| `GET` | `/api/pipeline/jobs` | List recent background jobs |
| `GET` | `/api/pipeline/jobs/{job_id}` | Check status and logs of a specific background task |

---

## 🛡️ License

MIT License. Designed for DPWH civil engineering data transparency and infrastructure analytics.
