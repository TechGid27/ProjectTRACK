# ProjectTRACK Mobile Client

The **ProjectTRACK Mobile Client** is the planned mobile companion for on-the-ground civic transparency, field monitoring, and citizen reporting of DPWH infrastructure projects across Cebu Province.

---

## 🎯 Objectives & Vision

* **📍 GPS-Aware Field Audits**: Automatically detect nearby DPWH projects based on real-time device geolocation.
* **📸 Citizen Photo Verification**: Allow citizens and civic researchers to submit geolocated photo updates and progress verification reports.
* **📶 Offline-First Access**: Cache project datasets locally for inspection even in remote mountain or coastal barangays with intermittent connectivity.
* **💬 Conversational Field Assistant**: Query project details, budget allocations, and contractor assignments on mobile via the ProjectTRACK AI Chat API.

---

## 🏗️ Planned Architecture

```text
mobile/
├── lib/ (or src/)          # Application source code
│   ├── api/                # REST & SSE Client for ProjectTRACK backend
│   ├── features/
│   │   ├── explorer/       # GPS project map & search
│   │   ├── audit/          # Field report photo upload & validation
│   │   └── chat/           # Streaming GraphRAG assistant
│   └── shared/             # Offline SQLite/Isar cache & UI primitives
└── Readme.md               # Mobile documentation & setup guide
```

---

## 🔌 Backend Integration

The mobile application connects directly to the **ProjectTRACK FastAPI Backend**:

* `GET /api/projects`: Search projects by LGU, keyword, or contractor.
* `GET /api/projects/{id}`: Detailed project card with budget, contractor, and timeline.
* `POST /api/chat`: Grounded domain QA with multi-tier fallback resilience.
* `GET /api/chat/stream`: Server-Sent Events (SSE) streaming answers for low-latency mobile UX.
* `GET /api/health`: Backend connectivity and Neo4j graph status checks.

---

## 🚀 Setup & Roadmap

Development is slated for upcoming development sprints. Contribution guidelines, tech stack confirmation, and getting-started instructions will be posted here as the mobile framework is initialized.
