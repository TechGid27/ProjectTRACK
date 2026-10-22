# DPWH Cebu Infrastructure API — JSON Examples Reference

This document provides complete, copy-pasteable JSON examples for all request payloads (**sent to the backend**) and response payloads (**returned by the backend**).

* **Base URL**: `http://localhost:8000`
* **API Prefix**: `/api`
* **Interactive Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## Table of Contents

1. [Chat & GraphRAG QA (`/api/chat`)](#1-chat--graphrag-qa-apichat)
   - [Standard Grounded AI Mode](#11-standard-grounded-ai-mode-post-apichat)
   - [Instant Cypher Lookup Mode](#12-instant-cypher-lookup-mode-post-apichat)
   - [Domain Guardrail Blocked Response](#13-domain-guardrail-blocked-response-post-apichat)
   - [Real-Time SSE Streaming Format](#14-real-time-sse-streaming-format-post-apichatstream)
2. [Projects API (`/api/projects`)](#2-projects-api-apiprojects)
   - [Exact Project Lookup with Geocoding](#21-exact-project-lookup-get-apiprojectsproject_id)
   - [Search Projects by Location](#22-search-projects-by-location-get-apiprojectsby-location)
   - [Full-Text Search Across Knowledge Graph](#23-full-text-search-get-apiprojectssearch)
   - [Map View Points (GIS Pins)](#24-map-view-points-get-apiprojectsmap)
3. [Analytics API (`/api/analytics`)](#3-analytics-api-apianalytics)
   - [Dataset Summary](#31-dataset-summary-get-apianalyticssummary)
   - [Geographic & Municipality Breakdown](#32-geographic--municipality-breakdown-get-apianalyticslocations)
   - [Top Contractors Leaderboard](#33-top-contractors-leaderboard-get-apianalyticstop-contractors)
   - [Top Infrastructure Projects](#34-top-infrastructure-projects-get-apianalyticstop-projects)
   - [GAA Appropriations by Office](#35-gaa-appropriations-by-office-get-apianalyticsappropriations)
   - [PhilGEPS Procurement Awards](#36-philgeps-procurement-awards-get-apianalyticsprocurement)
4. [Pipeline Administration (`/api/pipeline`)](#4-pipeline-administration-apipipeline)
   - [Trigger Supabase to Neo4j Sync](#41-trigger-batch-sync-post-apipelinesync)
   - [Trigger Apify Web Scraper](#42-trigger-scraper-post-apipelinescrape)
   - [Check Background Job Status](#43-check-background-job-status-get-apipipelinejobsjob_id)
5. [Health & Diagnostics (`/api/health`)](#5-health--diagnostics-apihealth)
   - [System Health Overview](#51-system-health-overview-get-apihealth)
   - [Neo4j Latency Ping](#52-neo4j-latency-ping-get-apihealthneo4j)
   - [LLM Availability Ping](#53-llm-availability-ping-get-apihealthllm)
6. [Standard Error Responses](#6-standard-error-responses)
   - [404 Project Not Found](#61-404-project-not-found)
   - [422 Validation Error](#62-422-validation-error)

---

## 1. Chat & GraphRAG QA (`/api/chat`)

### 1.1 Standard Grounded AI Mode (`POST /api/chat`)

Retrieves facts from Neo4j in `<20ms` and generates a grounded engineering summary with Groq (`qwen/qwen3.8-27b`).

#### **Request (Sent to Backend)**
```json
{
  "message": "Any flood control projects in Bogo City?",
  "history": [
    {
      "role": "user",
      "content": "Hello, I am inspecting civil works in northern Cebu."
    },
    {
      "role": "assistant",
      "content": "Hello! I can provide data on DPWH civil works projects, contractors, budgets, and locations across Cebu."
    }
  ],
  "mode": "ai"
}
```

#### **Response (Returned by Backend)**
```json
{
  "answer": "DPWH has active flood control and river mitigation initiatives in Bogo City, including Project 24HD0012 along the Bogo River. These projects focus on slope protection and drainage rehabilitation to safeguard nearby communities from seasonal flooding.",
  "graph_context": "Location: Bogo City\nTotal Projects in Graph: 87\nTotal Allocated Budget: ₱ 1.43B\nSample Projects:\n- Project 24HD0012: Construction of Flood Mitigation Structure along Bogo River | Budget: ₱ 49,000,000.00",
  "project_card": null,
  "matched_projects_count": 87,
  "guardrail": {
    "is_off_topic": false,
    "reason": null,
    "matched_rule": null
  },
  "mode": "ai",
  "duration_ms": 312.45,
  "model": "qwen/qwen3.8-27b"
}
```

---

### 1.2 Instant Cypher Lookup Mode (`POST /api/chat`)

Bypasses LLM generation entirely for instant `<10ms` response times. Ideal for mobile networks or zero-wait lookups.

#### **Request (Sent to Backend)**
```json
{
  "message": "24HH0043",
  "history": [],
  "mode": "instant"
}
```

#### **Response (Returned by Backend)**
```json
{
  "answer": "Project 24HH0043: Construction (Completion) of Multi-Purpose Building, Barangay Mabolo, Cebu City\nContractor: ZL2 BUILDERS\nBudget: ₱ 4,950,000.00\nLocation: Barangay Mabolo, Cebu City",
  "graph_context": "Project: DPWH Project 24HH0043\nCategory: Buildings and Other Structures\nLocation: Barangay Mabolo, Cebu City\nScope Description: Construction (Completion) of Multi-Purpose Building, Barangay Mabolo, Cebu City\nContractor: ZL2 BUILDERS\nImplementing Office: Cebu City DEO\nBudget: ₱ 4,950,000.00\nTimeline: 2024-03-01 to 2024-12-15\nStatus: Completed",
  "project_card": {
    "id": "24HH0043",
    "description": "Construction (Completion) of Multi-Purpose Building, Barangay Mabolo, Cebu City",
    "budget": "₱ 4,950,000.00",
    "budget_num": 4950000.0,
    "status": "Completed",
    "timeline": "120 Calendar Days",
    "url": "https://bettergov.ph/dpwh/cebu/24HH0043",
    "contractor": "ZL2 BUILDERS",
    "contractor_code": "41829",
    "location": "Barangay Mabolo, Cebu City",
    "office": "Cebu City District Engineering Office",
    "category": "Buildings and Other Structures"
  },
  "matched_projects_count": 1,
  "guardrail": {
    "is_off_topic": false,
    "reason": null,
    "matched_rule": "project_id_exemption"
  },
  "mode": "instant",
  "duration_ms": 8.74,
  "model": null
}
```

---

### 1.3 Domain Guardrail Blocked Response (`POST /api/chat`)

If an off-topic query (programming code, recipes, trivia, generic definitions, persona overrides) is submitted, the 5-layer domain guardrail rejects it in `<0.1ms` before hitting Neo4j or Ollama.

#### **Request (Sent to Backend)**
```json
{
  "message": "Write a python script to parse CSV files and compute average",
  "mode": "ai"
}
```

#### **Response (Returned by Backend)**
```json
{
  "answer": "Out of Scope: Programming and software code generation queries are outside system scope.\nThis assistant is strictly restricted to DPWH Cebu infrastructure projects, contractors, budgets, and locations.\n\nExample queries:\n• 'Any projects in Bogo?'\n• 'Who is the top contractor in Cebu?'\n• 'Tell me about project 24HH0043'",
  "graph_context": "",
  "project_card": null,
  "matched_projects_count": 0,
  "guardrail": {
    "is_off_topic": true,
    "reason": "Programming and software code generation queries are outside system scope.",
    "matched_rule": "programming_intent"
  },
  "mode": "ai",
  "duration_ms": 0.38,
  "model": null
}
```

---

### 1.4 Real-Time SSE Streaming Format (`POST /api/chat/stream`)

Streams response tokens using Server-Sent Events (`text/event-stream`).

#### **Request (Sent to Backend)**
```json
{
  "message": "Tell me about project 24HH0043",
  "mode": "ai"
}
```

#### **Response Stream (Received Token-by-Token)**
```text
event: context
data: {"has_targeted_project": true, "project_card": {"id": "24HH0043", "budget": "₱ 4,950,000.00"}, "matched_projects_count": 1, "graph_context": "Project: DPWH Project 24HH0043..."}

event: token
data: {"token": "Project "}

event: token
data: {"token": "24HH0043 "}

event: token
data: {"token": "covers the completion of a multi-purpose building "}

event: token
data: {"token": "in Barangay Mabolo, Cebu City, intended to provide communal space for barangay services."}

event: done
data: {"status": "completed", "duration_ms": 348.65}
```

---

## 2. Projects API (`/api/projects`)

### 2.1 Exact Project Lookup (`GET /api/projects/{project_id}`)

`GET /api/projects/24HH0043`

#### **Response (Returned by Backend)**
```json
{
  "id": "24HH0043",
  "description": "CONVERGENCE AND SPECIAL SUPPORT PROGRAM -BASIC INFRASTRUCTURE PROGRAM (BIP) - ACCESS ROADS AND / OR BRIDGES FROM THE NATIONAL ROAD/S LEADING TO MAJOR / STRATEGIC PUBLIC BUILDINGS / FACILILTIES - CONSTRUCTION OF ROAD, BARANGAY PARIL, CEBU CITY",
  "budget": "₱4,935,118.00 (Year: 2024)",
  "budget_num": 4935118,
  "status": "On-Going (100.0% complete)",
  "timeline": "2024-02-22 to N/A",
  "url": "https://transparency.bettergov.ph/dpwh/projects/24HH0043",
  "contractor": "POWER MOVE BUILDERS & CONSTRUCTION SUPPLY",
  "contractor_code": "22894",
  "location": "PARIL, CEBU CITY, CEBU",
  "latitude": 10.4283,
  "longitude": 123.8864,
  "municipality": "Cebu City",
  "barangay": "Paril",
  "formatted_address": "Brgy. Paril, Cebu City, Cebu, Philippines",
  "office": "Cebu City DEO (Jurisdiction: Cebu City (North & South Districts))",
  "category": "Roads",
  "geocoding": {
    "latitude": 10.4283,
    "longitude": 123.8864,
    "municipality": "Cebu City",
    "barangay": "Paril",
    "province": "Cebu",
    "formatted_address": "Brgy. Paril, Cebu City, Cebu, Philippines",
    "confidence": "barangay"
  }
}
```

---

### 2.2 Search Projects by Location (`GET /api/projects/by-location`)

`GET /api/projects/by-location?location=Mandaue&limit=2`

#### **Response (Returned by Backend)**
```json
{
  "location": "Mandaue",
  "latitude": 10.3323,
  "longitude": 123.9357,
  "municipality": "Mandaue City",
  "formatted_address": "Mandaue City, Cebu, Philippines",
  "total_count": 271,
  "total_budget": 10261396472.0,
  "total_budget_formatted": "₱ 10.26B",
  "showing_count": 2,
  "projects": [
    {
      "entity": "23H00059",
      "labels": ["Project"],
      "description": "CONST./ MAINTENANCE OF FLOOD MITIGATION STRUCTURES AND DRAINAGE SYSTEMS, CONST. OF FLOOD MITIGATION STRUCTURE ALONG TIPOLO RIVER, MANDAUE CITY, CEBU",
      "budget": "₱173,700,000.00 (Year: 2023)",
      "budget_num": 173700000.0,
      "status": "Completed (100.0% complete)",
      "url": "https://transparency.bettergov.ph/dpwh/projects/23H00059",
      "score": 1.0,
      "latitude": 10.3275,
      "longitude": 123.9356,
      "municipality": "Mandaue City",
      "barangay": "Tipolo",
      "formatted_address": "Brgy. Tipolo, Mandaue City, Cebu, Philippines",
      "relations": [
        {
          "rel": "LOCATED_IN",
          "target": "TIPOLO RIVER, MANDAUE CITY, CEBU",
          "desc": "TIPOLO RIVER, MANDAUE CITY, CEBU"
        },
        {
          "rel": "CONTRACTED_TO",
          "target": "ZLREJ TRADING AND CONSTRUCTION CORPORATION (49171) / GICAR CONSTRUCTION, INC.",
          "desc": "ZLREJ TRADING AND CONSTRUCTION CORPORATION (49171) / GICAR CONSTRUCTION, INC."
        }
      ]
    },
    {
      "entity": "24H00032",
      "labels": ["Project"],
      "description": "CONST. OF FLOOD CONTROL STRUCTURE ALONG MAHIGA CREEK, BARANGAY SUBANGDAKU, MANDAUE CITY, CEBU (PACKAGE II)",
      "budget": "₱173,599,999.98 (Year: 2024)",
      "budget_num": 173599999.0,
      "status": "On-Going (95.0% complete)",
      "url": "https://transparency.bettergov.ph/dpwh/projects/24H00032",
      "score": 1.0,
      "latitude": 10.3283,
      "longitude": 123.9286,
      "municipality": "Mandaue City",
      "barangay": "Subangdaku",
      "formatted_address": "Brgy. Subangdaku, Mandaue City, Cebu, Philippines",
      "relations": [
        {
          "rel": "LOCATED_IN",
          "target": "MAHIGA CREEK, BARANGAY SUBANGDAKU, MANDAUE CITY, CEBU",
          "desc": "MAHIGA CREEK, BARANGAY SUBANGDAKU, MANDAUE CITY, CEBU"
        }
      ]
    }
  ]
}
```

---

### 2.3 Full-Text Search (`GET /api/projects/search`)

`GET /api/projects/search?q=asphalt+rehabilitation&limit=1`

#### **Response (Returned by Backend)**
```json
[
  {
    "entity": "24HD0045",
    "labels": ["Project"],
    "description": "Preventive Maintenance / Asphalt Overlay along Cebu North Hagnaya Wharf Rd",
    "budget": "₱ 34,250,000.00",
    "budget_num": 34250000.0,
    "status": "On-Going (85.0% complete)",
    "url": "https://transparency.bettergov.ph/dpwh/projects/24HD0045",
    "score": 1.84,
    "latitude": 10.9500,
    "longitude": 123.9800,
    "municipality": "Medellin",
    "barangay": null,
    "formatted_address": "Medellin, Cebu, Philippines",
    "relations": [
      {
        "rel": "CONTRACTED_TO",
        "target": "PLD CONSTRUCTION",
        "desc": "Contractor"
      }
    ]
  }
]
```

---

### 2.4 Map View Points (`GET /api/projects/map`)

Optimized endpoint returning GeoJSON-ready GIS pins for interactive maps (Mapbox, Leaflet, Google Maps).

`GET /api/projects/map?municipality=Mandaue&limit=2`

#### **Response (Returned by Backend)**
```json
[
  {
    "id": "23H00059",
    "description": "CONST. OF FLOOD MITIGATION STRUCTURE ALONG TIPOLO RIVER, MANDAUE CITY, CEBU",
    "budget": "₱173,700,000.00 (Year: 2023)",
    "budget_num": 173700000.0,
    "status": "Completed (100.0% complete)",
    "contractor": "ZLREJ TRADING AND CONSTRUCTION CORPORATION",
    "location": "TIPOLO RIVER, MANDAUE CITY, CEBU",
    "latitude": 10.3275,
    "longitude": 123.9356,
    "municipality": "Mandaue City",
    "barangay": "Tipolo",
    "formatted_address": "Brgy. Tipolo, Mandaue City, Cebu, Philippines",
    "url": "https://transparency.bettergov.ph/dpwh/projects/23H00059"
  },
  {
    "id": "24H00032",
    "description": "CONST. OF FLOOD CONTROL STRUCTURE ALONG MAHIGA CREEK, BARANGAY SUBANGDAKU, MANDAUE CITY, CEBU",
    "budget": "₱173,599,999.98 (Year: 2024)",
    "budget_num": 173599999.0,
    "status": "On-Going (95.0% complete)",
    "contractor": "ZLREJ TRADING AND CONSTRUCTION CORPORATION",
    "location": "MAHIGA CREEK, BARANGAY SUBANGDAKU, MANDAUE CITY, CEBU",
    "latitude": 10.3283,
    "longitude": 123.9286,
    "municipality": "Mandaue City",
    "barangay": "Subangdaku",
    "formatted_address": "Brgy. Subangdaku, Mandaue City, Cebu, Philippines",
    "url": "https://transparency.bettergov.ph/dpwh/projects/24H00032"
  }
]
```

---

## 3. Analytics API (`/api/analytics`)

### 3.1 Dataset Summary (`GET /api/analytics/summary`)

`GET /api/analytics/summary`

#### **Response (Returned by Backend)**
```json
{
  "total_projects": 4530,
  "total_budget": 87425120450.0,
  "total_budget_formatted": "₱ 87.43B",
  "total_contractors": 312,
  "average_project_cost": 19299143.59
}
```

---

### 3.2 Geographic & Municipality Breakdown (`GET /api/analytics/locations`)

Returns aggregate project counts and budgets per Cebu city/municipality along with geographic centroids.

`GET /api/analytics/locations`

#### **Response (Returned by Backend)**
```json
[
  {
    "municipality": "Cebu City",
    "project_count": 842,
    "total_budget": 24500000000.0,
    "total_budget_formatted": "₱ 24.50B",
    "latitude": 10.3157,
    "longitude": 123.8854
  },
  {
    "municipality": "Mandaue City",
    "project_count": 271,
    "total_budget": 10261396472.0,
    "total_budget_formatted": "₱ 10.26B",
    "latitude": 10.3323,
    "longitude": 123.9357
  },
  {
    "municipality": "Toledo City",
    "project_count": 189,
    "total_budget": 4820000000.0,
    "total_budget_formatted": "₱ 4.82B",
    "latitude": 10.3789,
    "longitude": 123.6406
  }
]
```

---

### 3.3 Top Contractors Leaderboard (`GET /api/analytics/top-contractors`)

`GET /api/analytics/top-contractors?limit=3`

#### **Response (Returned by Backend)**
```json
[
  {
    "contractor": "QM BUILDERS",
    "code": "7494",
    "project_count": 142,
    "total_budget": 5890000000.0,
    "total_budget_formatted": "₱ 5.89B"
  },
  {
    "contractor": "WTG CONSTRUCTION & DEVELOPMENT CORP.",
    "code": "1284",
    "project_count": 98,
    "total_budget": 4120000000.0,
    "total_budget_formatted": "₱ 4.12B"
  },
  {
    "contractor": "FIRST GRANDEUR BUILDERS",
    "code": "3391",
    "project_count": 76,
    "total_budget": 2980000000.0,
    "total_budget_formatted": "₱ 2.98B"
  }
]
```

---

### 3.3 Top Infrastructure Projects (`GET /api/analytics/top-projects`)

`GET /api/analytics/top-projects?limit=2`

#### **Response (Returned by Backend)**
```json
[
  {
    "id": "23H00018",
    "budget": "₱ 985,000,000.00",
    "budget_num": 985000000.0,
    "description": "Metro Cebu Expressway (Cebu Circumferential Road), Package 3, Naga-Minglanilla Section",
    "contractor": "WTG CONSTRUCTION & DEVELOPMENT CORP.",
    "location": "City of Naga, Cebu"
  },
  {
    "id": "24H00002",
    "budget": "₱ 742,000,000.00",
    "budget_num": 742000000.0,
    "description": "Construction of 4-Lane Flyover along UN Avenue, Mandaue City, Cebu",
    "contractor": "QM BUILDERS",
    "location": "Mandaue City"
  }
]
```

---

### 3.5 GAA Appropriations by Office (`GET /api/analytics/appropriations`)

`GET /api/analytics/appropriations?limit=2`

#### **Response (Returned by Backend)**
```json
[
  {
    "office": "Cebu 6th District Engineering Office",
    "line_count": 627,
    "total_amount": 8299116.0,
    "total_amount_formatted": "₱ 8.30M",
    "years": [2020, 2021, 2022, 2023, 2024, 2025, 2026]
  },
  {
    "office": "Cebu 4th District Engineering Office",
    "line_count": 609,
    "total_amount": 7864096.0,
    "total_amount_formatted": "₱ 7.86M",
    "years": [2020, 2021, 2022, 2023, 2024, 2025, 2026]
  }
]
```

---

### 3.6 PhilGEPS Procurement Awards (`GET /api/analytics/procurement`)

`GET /api/analytics/procurement?contractor=construction&limit=1`

#### **Response (Returned by Backend)**
```json
[
  {
    "contractor": "RCV VILLAMOR CONSTRUCTION",
    "reference_id": "",
    "award_title": "Construction Project",
    "notice_title": "Construction of Multi-Purpose Building",
    "organization": "DEPARTMENT OF PUBLIC WORKS AND HIGHWAYS - CEBU 5TH DEO",
    "business_category": "Construction Projects",
    "contract_amount": 38420000.0,
    "contract_amount_formatted": "₱ 38.42M",
    "award_date": "2024-06-12 00:00:00",
    "award_status": "active",
    "match_confidence": "exact_name_cebu"
  }
]
```

---

## 4. Pipeline Administration (`/api/pipeline`)

### 4.1 Trigger Batch Sync (`POST /api/pipeline/sync`)

#### **Request (Sent to Backend)**
```json
{
  "batch_size": 500,
  "limit": 1000
}
```

#### **Response (Returned by Backend)**
```json
{
  "job_id": "7f8b9e24-4a2b-4ec9-8f33-1b072d689b7a",
  "job_type": "sync",
  "status": "queued",
  "started_at": "2026-10-14T15:11:00.281940Z",
  "completed_at": null,
  "message": "Sync job created and queued.",
  "progress": null,
  "error": null
}
```

---

### 4.2 Trigger Scraper (`POST /api/pipeline/scrape`)

#### **Request (Sent to Backend)**
```json
{
  "max_items": 100
}
```

#### **Response (Returned by Backend)**
```json
{
  "job_id": "8a3e7c51-5b1a-4d7a-a621-0c193e472f8b",
  "job_type": "scrape",
  "status": "queued",
  "started_at": "2026-10-14T15:11:15.109283Z",
  "completed_at": null,
  "message": "Scrape job created and queued.",
  "progress": null,
  "error": null
}
```

---

### 4.3 Check Background Job Status (`GET /api/pipeline/jobs/{job_id}`)

`GET /api/pipeline/jobs/7f8b9e24-4a2b-4ec9-8f33-1b072d689b7a`

#### **Response (Completed Job)**
```json
{
  "job_id": "7f8b9e24-4a2b-4ec9-8f33-1b072d689b7a",
  "job_type": "sync",
  "status": "completed",
  "started_at": "2026-10-14T15:11:00.281940Z",
  "completed_at": "2026-10-14T15:11:18.491024Z",
  "message": "Successfully synced projects to Neo4j Knowledge Graph.",
  "progress": null,
  "error": null
}
```

---

## 5. Health & Diagnostics (`/api/health`)

### 5.1 System Health Overview (`GET /api/health`)

`GET /api/health`

#### **Response (Returned by Backend)**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2026-10-14T15:11:30.984120Z",
  "neo4j": {
    "status": "healthy",
    "reachable": true,
    "latency_ms": 14.8,
    "message": "Connected to Neo4j Knowledge Graph"
  },
  "llm": {
    "status": "healthy",
    "reachable": true,
    "latency_ms": 2.1,
    "message": "Ollama model 'qwen2.5:1.5b' online"
  },
  "environment": "production"
}
```

---

### 5.2 Neo4j Latency Ping (`GET /api/health/neo4j`)

`GET /api/health/neo4j`

#### **Response (Returned by Backend)**
```json
{
  "status": "healthy",
  "reachable": true,
  "latency_ms": 12.35,
  "message": "Neo4j Aura operational"
}
```

---

### 5.3 LLM Availability Ping (`GET /api/health/llm`)

`GET /api/health/llm`

#### **Response (Returned by Backend)**
```json
{
  "status": "healthy",
  "reachable": true,
  "latency_ms": 1.82,
  "message": "Connected to qwen2.5:1.5b"
}
```

---

## 6. Field Report Verification (`/api/reports`)

### 6.1 Submit a Field Report (`POST /api/reports`)

Authenticated `multipart/form-data` submission (session cookie; no Authorization
header). Fields: `project_id`, `description`, `category`, `latitude`,
`longitude`, `picture`. The backend re-validates the ≤150m geofence and runs
ELA + perceptual-hash forensics before trusting the report.

#### **Status: `201 Created`**
```json
{
  "id": "4f1e8c2a-9b7d-4f3a-8c21-0a1b2c3d4e5f",
  "project_id": "24HH0043",
  "status": "verified",
  "distance_meters": 45,
  "geofence_pass": true,
  "ela_score": 0.42,
  "phash_recycled": false,
  "forensics_verdict": "clean",
  "reporter_reputation": 59,
  "created_at": "2026-10-20T12:00:00+00:00"
}
```

#### **Status: `429 Too Many Requests`** (4th report within 24h)
```json
{
  "detail": "Daily report limit reached (3 per 24 hours)."
}
```

### 6.2 List a Project's Reports (`GET /api/reports/{project_id}`)

#### **Status: `200 OK`**
```json
{
  "project_id": "24HH0043",
  "count": 1,
  "reports": [
    {
      "id": "4f1e8c2a-9b7d-4f3a-8c21-0a1b2c3d4e5f",
      "project_id": "24HH0043",
      "status": "verified",
      "distance_meters": 45,
      "geofence_pass": true,
      "ela_score": 0.42,
      "phash_recycled": false,
      "forensics_verdict": "clean",
      "reporter_reputation": 59,
      "created_at": "2026-10-20T12:00:00+00:00",
      "description": "Concrete works match the posted scope and schedule.",
      "category": "delay",
      "photo_url": "https://<project>.supabase.co/storage/v1/object/public/report-photos/24HH0043/ab12.jpg",
      "latitude": 11.0509,
      "longitude": 124.0055
    }
  ]
}
```

---

## 7. Standard Error Responses

### 7.1 404 Project Not Found

When querying a non-existent project code via `GET /api/projects/NONEXISTENT999`:

#### **Status: `404 Not Found`**
```json
{
  "detail": "Project 'NONEXISTENT999' was not found in the DPWH Cebu Knowledge Graph."
}
```

---

### 7.2 422 Validation Error

When a required query parameter or body field violates validation constraints (e.g. `POST /api/chat` with empty message `""`):

#### **Status: `422 Unprocessable Entity`**
```json
{
  "detail": [
    {
      "type": "string_too_short",
      "loc": [
        "body",
        "message"
      ],
      "msg": "String should have at least 1 character",
      "input": "",
      "ctx": {
        "min_length": 1
      }
    }
  ]
}
```
