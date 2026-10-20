# ProjectTrack Mobile Client

> **Geofenced field auditor for DPWH infrastructure verification across Cebu Province**

[![Expo SDK](https://img.shields.io/badge/Expo-SDK%2052-000020.svg?logo=expo)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.76-61DAFB.svg?logo=react)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6.svg?logo=typescript)](https://typescriptlang.org)

---

## Overview

The mobile client is the planned companion app for on-the-ground infrastructure monitoring. It enables field auditors and citizen volunteers to verify DPWH project progress with GPS-locked photo evidence, offline-capable data access, and a conversational assistant — all synced to the ProjectTrack backend.

### Capabilities

| Feature | Description |
| :--- | :--- |
| **GPS-Aware Field Audits** | Geofenced photo capture using `expo-location` and `expo-camera`, requiring physical proximity (≤150 m) to project coordinates before evidence can be submitted. The shutter stays locked until a live hardware GPS fix is inside the geofence. |
| **Server-Authoritative Verification** | Submissions are re-validated server-side: the backend recomputes the Haversine distance against the project's DPWH coordinates and runs ELA + perceptual-hash image forensics before trusting a report. |
| **Verification Badging** | Each submitted report surfaces its verdict — status, distance from site, forensics result, and reporter reputation — using the same schema as the web client. |
| **Offline-First Architecture** | An in-memory outbox queues audits captured offline; `api.syncPendingAudits()` POSTs them to the backend when connectivity returns, marking each synced on success. |
| **Conversational Field Assistant** | On-device access to the GraphRAG chat via SSE streaming for contextual project queries. |
| **Interactive Map** | SVG vector map of Cebu's 53 LGUs with project markers and contractor overlays. |

> **Status:** Core UI screens (Home, Map, Contractor Ranking, Sign In / Sign Up),
> the API service layer, geofenced hardware capture, live report submission with
> verification badging, and the offline outbox sync are implemented and tested.

---

## Prerequisites

| Tool | Version | Verification |
| :--- | :--- | :--- |
| Node.js | 18+ (LTS recommended) | `node -v` |
| npm | 9+ | `npm -v` |
| Expo CLI | Latest | `npx expo --version` |
| Android Studio _or_ Xcode | For emulator / simulator | — |

---

## Quick Start

```bash
# Install dependencies
cd mobile
npm install

# Start the Expo development server
npm run dev

# Or target a specific platform
npm run android
npm run ios
npm run web
```

### Environment Configuration

Copy the environment template and adjust as needed:

```bash
cp .env.example .env
```

Key variables:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `API_BASE_URL` | `http://10.0.2.2:8000/api` | Backend gateway (`10.0.2.2` is the Android emulator's host alias) |
| `GEOFENCE_RADIUS_METERS` | `100` | Required proximity to project coordinates for photo capture |
| `MAX_OFFLINE_QUEUE_ITEMS` | `500` | Maximum queued observations before forced sync |
| `ENABLE_MOCK_GPS` | `false` | Set `true` only for emulator testing |

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start Expo development server |
| `npm run android` | Launch on Android emulator |
| `npm run ios` | Launch on iOS simulator |
| `npm run web` | Launch in browser (Expo web) |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking (`tsc --noEmit`) |
| `npm run test` | Run Jest test suite |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run audit` | Allowlist-aware `npm audit` gate (see Security note below) |

---

## Project Structure

```text
mobile/
├── App.tsx                  # Root component
├── src/
│   ├── core/                # Shared types and geo utilities (Haversine, coordinate math)
│   ├── data/                # Static data, mock API fixtures, FAQ entries
│   ├── services/            # API client, haptics service, offline outbox queue
│   ├── ui/
│   │   ├── components/      # Reusable UI components (BottomTabBar, MapHeader, etc.)
│   │   └── screens/         # App screens (Home, Map, Contractors, Auth)
│   └── assets/              # GeoJSON boundaries and static assets
├── __tests__/               # Jest test suite (18 test files)
├── app.json                 # Expo configuration
├── tsconfig.json            # TypeScript configuration
├── babel.config.js          # Babel configuration
├── eslint.config.js         # ESLint flat config
└── jest.config.js           # Jest configuration
```

---

## Backend Integration

The mobile client communicates with the ProjectTrack FastAPI backend:

| Endpoint | Usage |
| :--- | :--- |
| `GET /api/projects` | Fetch project listings for map display |
| `GET /api/projects/{id}` | Retrieve individual project details (including disbursements, funding source, PhilGEPS awards) |
| `GET /api/analytics/summary` | Knowledge graph statistics across Cebu Province |
| `GET /api/analytics/top-contractors` | Contractor rankings by cumulative infrastructure budget |
| `GET /api/analytics/appropriations` | GAA budget appropriations aggregated by district office |
| `GET /api/analytics/procurement` | PhilGEPS bidding awards attached to Cebu contractors |
| `POST /api/auth/signin` | Supabase password authentication with HTTP-only session cookie |
| `POST /api/auth/signup` | Supabase citizen and verifier account registration |
| `GET /api/auth/session` | Active session status and transparent token refresh |
| `POST /api/chat` | Send queries to GraphRAG assistant (returns answers, sources, spatial camera targets) |
| `GET /api/chat/stream` | SSE streaming for real-time AI responses |
| `POST /api/reports` | Submit a geofenced, forensic field report (multipart, session cookie) |
| `GET /api/reports/{id}` | List a project's reports with verification badges |
| `GET /api/health` | Backend connectivity check |

---

## Testing

The test suite covers core utilities, API services, UI components, and screen rendering:

```bash
# Run all tests
npm run test

# Run with coverage
npm run test:coverage
```

Coverage thresholds (enforced in `jest.config.js`):

| Metric | Threshold |
| :--- | :--- |
| Branches | 80% |
| Functions | 80% |
| Lines | 80% |
| Statements | 80% |

---

## Security / Dependency Audit

The CI **Security Audit** workflow runs `npm run audit` for this package. A plain
`npm audit --audit-level=high` cannot pass here: the Expo SDK 52 / React Native
0.76 / jest-expo build toolchain pulls transitive advisories (node-tar,
node-forge, postcss, braces, @xmldom/xmldom, ...) whose only npm remediation is a
breaking `expo@44` downgrade. Those advisories are **not** introduced by this
project's direct dependencies.

`npm run audit` (`scripts/audit-check.js`) is an allowlist-aware gate:

- `mobile/.npm-audit-allow.json` lists the known, documented Expo-toolchain
  advisory ids that are accepted until the next Expo SDK upgrade.
- The gate still **fails** on any new high/critical advisory outside that list,
  so genuinely new vulnerabilities are not masked.

When upgrading the Expo SDK, re-run `npm run audit` and prune any ids that no
longer appear from `.npm-audit-allow.json`.

---

## Contributing

See the root [CONTRIBUTING.md](../CONTRIBUTING.md) for branching strategy, commit conventions, and pull request guidelines.
