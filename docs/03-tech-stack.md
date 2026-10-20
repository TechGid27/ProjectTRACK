# 03. Technology Stack and Architecture Justifications

This document outlines the architectural trade-offs, technology evaluations, and framework selections underlying the ProjectTrack civic intelligence platform.

---

## 1. Technology Matrix Overview

| Layer | Selected Technology | Alternative Considered | Primary Justification |
| :--- | :--- | :--- | :--- |
| **API Gateway & Backend** | **FastAPI (Python 3.10+)** | Django, Flask, Express.js | Asynchronous ASGI execution, automatic OpenAPI schema generation, native Pydantic type safety, and Server-Sent Events (SSE) streaming support. |
| **Knowledge Graph Database** | **Neo4j AuraDB** | PostgreSQL (Relational), MongoDB, ArangoDB | Sub-20ms multi-hop traversals connecting projects, contractors, and public officials; expressive Cypher querying; native graph algorithms. |
| **Document Lake & Archive** | **Supabase (PostgreSQL / Storage)** | AWS S3 + RDS, Firebase | Unified PostgreSQL relational storage with S3-compatible object storage for scraped procurement documents and audit logs. |
| **Data Extraction Pipeline** | **Apify & Custom Python Crawlers** | Scrapy, Playwright standalone | Managed cloud scheduling, automated proxy rotation for public registries, and resilient error recovery during bulk scraping. |
| **Web Presentation Tier** | **React 19 + Vite 8** | Next.js, Vue 3, Angular | High-performance client-side rendering, sub-second Hot Module Replacement (HMR), minimal bundle footprint, and concurrent rendering support. |
| **Geospatial & Cartography** | **Leaflet + React-Leaflet** | Mapbox GL JS, Google Maps Platform | Fully open-source, zero per-tile commercial API costs, lightweight GeoJSON polygon rendering for 53 LGUs without satellite bandwidth bottlenecks. |
| **Styling & Design System** | **Tailwind CSS v4** | CSS Modules, MUI, Chakra UI | Zero-runtime CSS engine, rapid utility-first responsiveness, and inline color scale customization. |
| **LLM & Reasoning Engine** | **Configurable** (Groq `qwen/qwen3.8-27b` default, MiMo-V2-Flash via HF, or local Ollama) | OpenAI GPT-4o, Anthropic Claude 3.5 | Pluggable provider via environment variables. Groq delivers ~500 tok/s; HuggingFace free tier offers zero-cost evaluation; Ollama local fallback (`qwen2.5:0.5b`) ensures offline operation. |
| **Mobile Field Client** | **React Native with Expo** | Flutter, Native Kotlin/Swift | Managed mobile toolchain with Expo Location, Expo Camera, Expo SQLite, cross-platform Android/iOS deployment, and zero-config device testing via Expo Go. |

---

## 2. In-Depth Technical Justifications

### 2.1 Backend Framework: FastAPI
* **High-Throughput Asynchronous I/O**: DPWH data retrieval involves concurrent operations (fetching GeoJSON boundaries, executing Cypher queries, invoking LLM inference streams). FastAPI's asynchronous architecture handles high concurrent user volume with minimal CPU overhead.
* **Declarative Schema Validation with Pydantic v2**: Strict request and response schemas guarantee that invalid coordinates, malformed project IDs, or anomalous budget figures are caught and reported with standardized HTTP 422 errors prior to reaching internal business logic.
* **Native SSE Streaming**: Real-time natural language synthesis requires token streaming. FastAPI's `StreamingResponse` natively delivers Server-Sent Events to both web and mobile frontends.

### 2.2 Knowledge Graph: Neo4j AuraDB
* **Relational Multi-Hop Queries vs SQL Joins**: In traditional SQL, cross-referencing a project with its contractor, that contractor's board members, previous contracts, and geographical districts requires joining 5 to 7 tables. In Neo4j, these connections are first-class pointer relationships traversed in under 20 milliseconds:
  ```cypher
  MATCH (p:Project {id: $id})-[:AWARDED_TO]->(c:Contractor)<-[:AWARDED_TO]-(other:Project)
  RETURN c.name, count(other) AS total_contracts, sum(other.budget) AS aggregate_budget
  ```
* **Full-Text Graph Search**: Native Lucene indexes built into Neo4j permit rapid fuzzy search across project titles and civil works classifications without necessitating external Elasticsearch infrastructure.

### 2.3 Cartographic Architecture: Leaflet and Vector GeoJSON
* **Low-Bandwidth Accessibility**: Rural and coastal communities across Cebu often experience constrained network speeds. Relying on satellite tile layers (such as Google Maps or Mapbox) consumes megabytes of image data per session.
* **Vector Polygon Rendering**: ProjectTrack utilizes simplified GeoJSON polygon boundaries (`gbOpen PHL/ADM3` from NAMRIA/PSA data) rendered as flat vector geometries. This reduces initial cartographic payload transfer to under 100 KB while allowing custom status styling and smooth boundary zooming.

### 2.4 Language Model: Configurable LLM Provider
* **Zero-Cost Accessibility for Civic Initiatives**: The LLM provider is fully configurable via environment variables. The code defaults to Groq's `qwen/qwen3.8-27b` for high-throughput inference (~500 tok/s). For zero-cost evaluation, contributors can point to Xiaomi MiMo (`XiaomiMiMo/MiMo-V2-Flash`) via the Hugging Face free inference tier.
* **Local Offline Fallback (Ollama)**: In air-gapped or localized environments, the system automatically routes inference to a local Ollama instance running on `localhost:11434`, ensuring complete sovereign data privacy when required.

### 2.5 Mobile Architecture: React Native with Expo
* **Direct Hardware Sensor Access via Managed SDK**: `expo-location` and `expo-camera` provide robust cross-platform abstractions over Android LocationServices and iOS CoreLocation, essential for enforcing hardware-level geofencing without maintaining diverging native codebases.
* **Offline Persistence with `expo-sqlite`**: Transactional local caching ensures reliable audit capture in low-connectivity areas.
* **Rapid Developer Experience & Evaluation via Expo Go**: Judges and contributors can test the mobile client directly on physical iOS and Android devices by scanning a QR code, avoiding the complex local SDK setup required by bare native frameworks.
* **Production Automation with EAS**: Expo Application Services (EAS Build) enables cloud compiling of native binaries (APK/AAB/IPA) directly from CI/CD pipelines.

---

## 3. Monorepo Architecture Trade-Offs

The project is structured as a monorepo to optimize developer velocity and shared data models:

* **Benefits**:
  * Unified versioning across web, backend, and mobile assets.
  * Shared documentation and standardized setup scripts for hackathon evaluation.
  * Direct synchronization between backend API schema definitions and frontend data consumption.
* **Mitigations**:
  * Decoupled package dependencies (Python virtual environment for backend; independent `package.json` for frontend and mobile Expo workspace) to avoid dependency bloat across runtime boundaries.
