# ProjectTrack Mobile Client

> **Geofenced field auditor for DPWH infrastructure verification across Cebu Province**

[![Expo SDK](https://img.shields.io/badge/Expo-SDK%2052-000020.svg?logo=expo)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.76-61DAFB.svg?logo=react)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6.svg?logo=typescript)](https://typescriptlang.org)

---

## Overview

The mobile client is the planned companion app for on-the-ground infrastructure monitoring. It enables field auditors and citizen volunteers to verify DPWH project progress with GPS-locked photo evidence, offline-capable data access, and a conversational assistant — all synced to the ProjectTrack backend.

### Planned Capabilities

| Feature | Description |
| :--- | :--- |
| **GPS-Aware Field Audits** | Geofenced photo capture using `expo-location` and `expo-camera`, requiring physical proximity (100 m) to project coordinates before evidence can be submitted. |
| **Offline-First Architecture** | Local SQLite storage (`expo-sqlite`) with background sync and an idempotent queue for low-connectivity field conditions. |
| **Citizen Photo Verification** | EXIF metadata extraction, SHA-256 hashing, and server-side ELA analysis for tamper detection. |
| **Conversational Field Assistant** | On-device access to the GraphRAG chat via SSE streaming for contextual project queries. |
| **Interactive Map** | SVG vector map of Cebu's 53 LGUs with project markers and contractor overlays. |

> **Note:** The mobile client is in active development. Core UI screens (Home, Map, Contractor Ranking, Sign In / Sign Up) and the API service layer are implemented. Geofenced photo capture and offline sync are slated for upcoming sprints.

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
| `GET /api/projects/{id}` | Retrieve individual project details |
| `POST /api/chat` | Send queries to the GraphRAG assistant |
| `GET /api/chat/stream` | SSE streaming for real-time AI responses |
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

## Contributing

See the root [CONTRIBUTING.md](../CONTRIBUTING.md) for branching strategy, commit conventions, and pull request guidelines.
