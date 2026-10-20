# 05. API Reference and Endpoint Specifications

This document defines the RESTful and Server-Sent Events (SSE) interfaces exposed by the ProjectTrack FastAPI application.

* **Base URL**: `http://localhost:8000`
* **API Prefix**: `/api`
* **OpenAPI Interactive Documentation**: `http://localhost:8000/docs`
* **ReDoc Specification**: `http://localhost:8000/redoc`

---

## 1. Chat and GraphRAG QA Endpoints

### 1.1 Execute GraphRAG Query
`POST /api/chat`

Executes a natural language query against the Neo4j knowledge graph. Supports grounded AI synthesis (`mode: "ai"`) or low-latency instant Cypher lookups (`mode: "instant"`).

#### Request Headers
```http
Content-Type: application/json
Accept: application/json
```

#### Request Payload
```json
{
  "message": "Which contractors have flood control projects in Bogo City?",
  "history": [
    {
      "role": "user",
      "content": "Hello, I am inspecting civil works in northern Cebu."
    },
    {
      "role": "assistant",
      "content": "Hello. I can assist with DPWH projects, budgets, and contractors in Cebu."
    }
  ],
  "mode": "ai"
}
```

#### Response Payload (`200 OK`)
```json
{
  "answer": "DPWH has active flood mitigation projects in Bogo City, including Project 24HD0012 along the Bogo River. The contract is executed by QM Builders with an allocated budget of PHP 49,000,000.00.",
  "graph_context": "Location: Bogo City\nTotal Projects: 87\nTotal Allocated Budget: PHP 1.43B\nSample Project: 24HD0012 (Construction of Flood Mitigation Structure along Bogo River)",
  "project_card": null,
  "matched_projects_count": 87,
  "guardrail": {
    "is_off_topic": false,
    "reason": null,
    "matched_rule": null
  },
  "mode": "ai",
  "duration_ms": 314.25,
  "model": "XiaomiMiMo/MiMo-V2-Flash"
}
```

---

### 1.2 Instant Cypher Lookup Mode
`POST /api/chat` (`mode: "instant"`)

Bypasses LLM inference entirely for sub-10ms response times. Ideal for exact project ID lookups or bandwidth-constrained mobile devices.

#### Request Payload
```json
{
  "message": "24HH0043",
  "history": [],
  "mode": "instant"
}
```

#### Response Payload (`200 OK`)
```json
{
  "answer": "Project 24HH0043: Construction of Drainage Structure along Colon St., Cebu City. Allocated budget: PHP 34,300,000.00 awarded to ABC Construction & Supply.",
  "graph_context": null,
  "project_card": {
    "id": "24HH0043",
    "name": "Construction of Drainage Structure along Colon St., Cebu City",
    "budget": 34300000.0,
    "formatted_budget": "PHP 34,300,000.00",
    "contractor": "ABC Construction & Supply",
    "location": "Cebu City",
    "district": "Cebu City 1st DEO",
    "status": "Ongoing",
    "completion_percentage": 68.5,
    "coordinates": {
      "latitude": 10.2974,
      "longitude": 123.8973
    }
  },
  "matched_projects_count": 1,
  "guardrail": {
    "is_off_topic": false,
    "reason": null,
    "matched_rule": null
  },
  "mode": "instant",
  "duration_ms": 8.42,
  "model": null
}
```

---

### 1.3 Real-Time SSE Token Streaming
`POST /api/chat/stream`

Streams tokens incrementally via Server-Sent Events (SSE) using the standard `text/event-stream` media type.

#### Event Stream Format
```text
event: metadata
data: {"matched_projects_count": 87, "duration_graph_ms": 14.2}

event: delta
data: {"token": "DPWH "}

event: delta
data: {"token": "has "}

event: delta
data: {"token": "active "}

event: complete
data: {"total_duration_ms": 284.1, "model": "XiaomiMiMo/MiMo-V2-Flash"}
```

---

## 2. Projects Endpoints

### 2.1 Get Project by Identifier
`GET /api/projects/{project_id}`

Retrieves complete attributes, spatial coordinates, financial summaries, and contractor associations for an individual infrastructure project.

#### Parameters
* `project_id` *(path, required)*: Official DPWH project or contract identifier (e.g. `24HH0043`).

#### Response Payload (`200 OK`)
```json
{
  "id": "24HH0043",
  "name": "Construction of Drainage Structure along Colon St.",
  "category": "Flood Control and Drainage",
  "budget": 34300000.0,
  "formatted_budget": "PHP 34,300,000.00",
  "amount_paid": 12500000.0,
  "source_of_funds": "Regular Infra - GAA 2024 CP",
  "funding_source": "Regular Infra - GAA 2024 CP",
  "program_name": "Regular Infra",
  "region": "Region VII",
  "status": "Ongoing",
  "completion_percentage": 68.5,
  "year": 2024,
  "contractor": {
    "name": "ABC Construction & Supply",
    "license_no": "PCAB-78910",
    "classification": "General Engineering",
    "total_awarded_budget": 412500000.0
  },
  "procurements": [
    {
      "reference_id": "2024-00123",
      "award_title": "Construction Project",
      "notice_title": "Invitation to Bid - Drainage along Colon St.",
      "organization": "DPWH Cebu City DEO",
      "contract_amount": 34300000.0,
      "award_date": "2024-01-15 00:00:00",
      "award_status": "active",
      "match_confidence": "exact_name_cebu"
    }
  ],
  "location": {
    "municipality": "Cebu City",
    "barangay": "Parian",
    "district": "Cebu City 1st District Engineering Office",
    "latitude": 10.2974,
    "longitude": 123.8973
  },
  "source_url": "https://dpwh.gov.ph/portal/projects/24HH0043"
}
```

---

### 2.2 Search Projects by Location
`GET /api/projects/by-location`

#### Parameters
* `location` *(query, required)*: Municipality or city name (e.g. `Bogo City`, `Danao`, `Minglanilla`).
* `limit` *(query, optional, default: 20)*: Maximum records to return.

#### Response Payload (`200 OK`)
```json
{
  "location": "Bogo City",
  "count": 87,
  "total_budget": 1432000000.0,
  "projects": [
    {
      "id": "24HD0012",
      "name": "Construction of Flood Mitigation Structure along Bogo River",
      "budget": 49000000.0,
      "status": "Ongoing",
      "contractor": "QM Builders"
    }
  ]
}
```

---

### 2.3 Full-Text Graph Search
`GET /api/projects/search`

Executes fuzzy search across project titles, categories, and contractor names.

#### Parameters
* `q` *(query, required)*: Free-text search string.
* `limit` *(query, optional, default: 10)*: Maximum records to return.

---

## 3. Analytics Endpoints

### 3.1 Dataset Overview Summary
`GET /api/analytics/summary`

Returns province-wide infrastructure statistics aggregated directly from the Neo4j knowledge graph.

#### Response Payload (`200 OK`)
```json
{
  "total_projects": 4372,
  "total_budget": 84920400000.0,
  "formatted_total_budget": "PHP 84.92 Billion",
  "total_contractors": 318,
  "total_locations": 53,
  "ongoing_projects": 1845,
  "completed_projects": 2527,
  "last_synchronized_at": "2026-10-15T08:00:00Z"
}
```

---

### 3.2 Top Contractors Leaderboard
`GET /api/analytics/top-contractors`

#### Parameters
* `limit` *(query, optional, default: 10)*: Number of contractors to retrieve.

#### Response Payload (`200 OK`)
```json
{
  "limit": 3,
  "contractors": [
    {
      "rank": 1,
      "name": "QM Builders",
      "awarded_projects_count": 84,
      "total_awarded_budget": 4210000000.0,
      "formatted_total_awarded_budget": "PHP 4.21 Billion"
    },
    {
      "rank": 2,
      "name": "WTG Construction & Development Corp.",
      "awarded_projects_count": 62,
      "total_awarded_budget": 3540000000.0,
      "formatted_total_awarded_budget": "PHP 3.54 Billion"
    },
    {
      "rank": 3,
      "name": "Duros Development Corporation",
      "awarded_projects_count": 55,
      "total_awarded_budget": 3120000000.0,
      "formatted_total_awarded_budget": "PHP 3.12 Billion"
    }
  ]
}
```

---

### 3.3 GAA Appropriations by District Office
`GET /api/analytics/appropriations`

Aggregates General Appropriations Act (GAA) budget line items per DPWH Cebu district engineering office, sourced from the BetterGov `gaa` index.

#### Parameters
* `limit` *(query, optional, default: 50, max: 100)*: Number of district offices to retrieve.

#### Response Payload (`200 OK`)
```json
[
  {
    "office": "Cebu 6th District Engineering Office",
    "line_count": 627,
    "total_amount": 8299116.0,
    "total_amount_formatted": "₱ 8.30M",
    "years": [2020, 2021, 2022, 2023, 2024, 2025, 2026]
  }
]
```

---

### 3.4 PhilGEPS Procurement Awards
`GET /api/analytics/procurement`

Lists PhilGEPS procurement/bidding awards conservatively linked to DPWH Cebu contractors (awardee-name + Cebu `area_of_delivery` match). Each item carries a `match_confidence` flag and never overwrites authoritative DPWH facts.

#### Parameters
* `contractor` *(query, optional)*: Partial, case-insensitive contractor-name filter.
* `limit` *(query, optional, default: 50, max: 200)*: Maximum awards to return.

#### Response Payload (`200 OK`)
```json
[
  {
    "contractor": "ARQ BUILDERS",
    "reference_id": "2024-00123",
    "award_title": "Construction Project",
    "notice_title": "Invitation to Bid - Access Road",
    "organization": "TOURISM INFRASTRUCTURE AND ENTERPRISE ZONE AUTHORITY",
    "business_category": "Construction Projects",
    "contract_amount": 49980000.0,
    "contract_amount_formatted": "₱ 49.98M",
    "award_date": "2024-01-15 00:00:00",
    "award_status": "active",
    "match_confidence": "exact_name_cebu"
  }
]
```

> **Note**: `GET /api/projects/{project_id}` also returns a nested `procurements` array and the project-level `amount_paid`, `source_of_funds`, and `funding_source` fields. `GET /api/projects/map` and `GET /api/projects/search` now include `amount_paid` and `source_of_funds` on each item.

---

## 4. Health and Diagnostics Endpoints

### 4.1 System Health
`GET /api/health`

#### Response Payload (`200 OK`)
```json
{
  "status": "healthy",
  "app_name": "DPWH Cebu Knowledge Graph API",
  "version": "1.0.0",
  "environment": "production",
  "timestamp": "2026-10-15T12:00:00Z"
}
```

### 4.2 Neo4j Latency Ping
`GET /api/health/neo4j`

Returns round-trip query latency to the Neo4j cluster.

#### Response Payload (`200 OK`)
```json
{
  "status": "connected",
  "latency_ms": 11.45,
  "database_edition": "enterprise",
  "node_count": 18920
}
```
