# Contributing to ProjectTrack

Thank you for your interest in contributing to **ProjectTrack**. This platform is dedicated to promoting civic transparency, open governance, and verifiable public infrastructure monitoring across Cebu, Philippines.

We welcome contributions from software engineers, GIS specialists, data journalists, student researchers, and civic advocates.

* **Repository**: [https://github.com/kaids77/ProjectTRACK](https://github.com/kaids77/ProjectTRACK)
* **Lead Maintainer**: Charlie C. Mangyao (`kaids77`)
* **Contact**: `charliemangyao@gmail.com`

---

## 1. Code of Conduct

All contributors, maintainers, and community participants are expected to adhere to the [Code of Conduct](CODE_OF_CONDUCT.md). Please review it before participating in discussions, opening issues, or submitting pull requests.

---

## 2. Branching Strategy

ProjectTrack utilizes a structured Git branching workflow:

* **`main`**: Production-ready, stable releases.
* **`development`**: Active integration branch where ongoing features, refactors, and documentations are merged.
* **Feature & Fix Branches**: Always branch off **`development`** using descriptive prefixes:
  * `feat/<feature-name>` (e.g., `feat/barangay-polygon-layer`)
  * `fix/<bug-description>` (e.g., `fix/neo4j-connection-timeout`)
  * `docs/<topic>` (e.g., `docs/api-reference-update`)
  * `refactor/<subsystem>` (e.g., `refactor/expo-location-service`)
  * `test/<component>` (e.g., `test/guardrail-benchmarks`)

---

## 3. Local Development Setup

Refer to our modular guides based on your area of contribution:

* **System Setup Overview**: [docs/01-getting-started.md](docs/01-getting-started.md)
* **Architecture & Data Pipeline**: [docs/02-architecture.md](docs/02-architecture.md)
* **Docker & Local Deployment**: [docs/04-setup-guide.md](docs/04-setup-guide.md)
* **Web Frontend (React 19 + Leaflet)**: [Website/README.md](Website/README.md)
* **Mobile Field Client (React Native Expo)**: [Mobile/Readme.md](Mobile/Readme.md)
* **Backend & Scraper Pipelines**: [backend/README.md](backend/README.md)

---

## 4. Coding Standards and Style

### Python (Backend & Pipeline)
* Adhere to **PEP 8** style guidelines.
* Maintain strict type hinting on all public functions, services, and FastAPI routes.
* Validate external payloads using **Pydantic v2** models.
* Run formatting checks prior to opening a PR:
  ```bash
  flake8 backend
  black --check backend
  ```

### JavaScript / React (Web Platform)
* Follow standard React 19 functional component conventions with modern hooks.
* Maintain clean ESLint compliance:
  ```bash
  cd Website
  npm run lint
  ```
* Avoid inline styles when Tailwind CSS utilities are applicable.
* Maintain low-bandwidth efficiency for cartographic assets (e.g. simplified GeoJSON features).

### React Native Expo (Mobile Field Client)
* Use Expo CLI (`npx expo`) for local development and testing with Expo Go.
* Restrict native sensor operations to managed Expo modules (`expo-location`, `expo-camera`, `expo-sqlite`, `expo-crypto`).
* Ensure geofencing logic uses standardized coordinate tolerance models (Haversine formula).

---

## 5. Commit Message Conventions

We adhere to the [Conventional Commits](https://www.conventionalcommits.org/) standard:

```text
<type>(<scope>): <short description>

[optional body]

[optional footer(s)]
```

### Examples:
* `feat(map): implement dynamic barangay layer switching at zoom level 12`
* `fix(backend): correct budget aggregate precision in analytics router`
* `docs(api): add response payload schemas for chat streaming endpoint`
* `refactor(mobile): optimize expo-sqlite transaction batching for offline sync`

---

## 6. Pull Request Submission Checklist

When opening a Pull Request:

1. Target your PR to **`development`** (do not submit PRs directly to `main` unless it is an authorized production release).
2. Ensure existing tests pass and linting checks are resolved without warnings.
3. Update relevant documentation in `docs/` or sub-package READMEs if APIs or configuration parameters changed.
4. Fill out the [Pull Request Template](.github/PULL_REQUEST_TEMPLATE.md) completely, including verification steps and rationale.
5. Reference any related GitHub issue numbers (e.g., `Closes #12`).

---

## 7. Security and Vulnerability Reporting

If you discover a potential security vulnerability (such as exposed credentials, Cypher injection risks, or bypasses in image forensics), please refer to our [Security Policy](SECURITY.md) and report it responsibly to `charliemangyao@gmail.com` rather than opening a public issue.
