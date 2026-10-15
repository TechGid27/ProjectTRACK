# Contributing to ProjectTrack

Thank you for your interest in contributing to ProjectTrack. This project is dedicated to promoting civic transparency, open governance, and verifiable public infrastructure monitoring across Cebu, Philippines.

We welcome contributions from software engineers, GIS specialists, data journalists, and civic advocates.

---

## 1. Code of Conduct

All contributors, maintainers, and community participants are expected to adhere to the [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before participating in discussions, issues, or pull requests.

---

## 2. Branching Strategy

ProjectTrack utilizes a structured Git branching model:

* **`main`**: Production-ready, stable releases.
* **`development`**: Active integration branch where ongoing features, refactors, and documentations are merged.
* **Feature / Fix Branches**: Branch off `development` using descriptive naming:
  * `feat/<feature-name>` (e.g., `feat/barangay-polygon-layer`)
  * `fix/<bug-description>` (e.g., `fix/neo4j-connection-timeout`)
  * `docs/<topic>` (e.g., `docs/api-reference-update`)
  * `test/<component>` (e.g., `test/guardrail-benchmarks`)

---

## 3. Local Development Setup

Refer to the following guides based on your development area:

* System Setup Overview: [docs/01-getting-started.md](docs/01-getting-started.md)
* Containerized / Docker Setup: [docs/04-setup-guide.md](docs/04-setup-guide.md)
* Web Frontend Development: [Website/README.md](Website/README.md)
* Mobile Field Client: [Mobile/README.md](Mobile/README.md)
* Backend & Pipelines: [backend/README.md](backend/README.md)

---

## 4. Coding Standards and Style

### Python (Backend & Pipeline)
* Follow **PEP 8** style guidelines.
* Maintain strict type hinting on all public functions and FastAPI routes.
* Validate external input and database models using **Pydantic v2**.
* Run formatting checks:
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
* Maintain low-bandwidth efficiency for geospatial layers (e.g. simplified GeoJSON features).

### React Native Expo (Mobile Field Client)
* Use Expo CLI (`npx expo`) for local development and testing with Expo Go.
* Restrict native sensor operations to managed Expo modules (`expo-location`, `expo-camera`, `expo-sqlite`, `expo-crypto`).
* Ensure geofencing logic uses standardized coordinate tolerance models.

---

## 5. Commit Message Conventions

We adhere to the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```text
<type>(<scope>): <short description>

[optional body]

[optional footer(s)]
```

### Examples:
* `feat(map): implement dynamic barangay layer switching at zoom level 12`
* `fix(backend): correct budget aggregate precision in analytics router`
* `docs(api): add response payload schemas for chat streaming endpoint`
* `refactor(pipeline): optimize cypher batch ingestion page size`

---

## 6. Pull Request Submission Checklist

When opening a Pull Request:

1. Base your branch against **`development`** (do not submit PRs directly to `main` unless it is a tagged release).
2. Ensure existing tests pass and linting checks are resolved.
3. Update relevant documentation in `docs/` or sub-package READMEs if APIs or configuration parameters changed.
4. Fill out the [Pull Request Template](.github/PULL_REQUEST_TEMPLATE.md) completely, including verification steps and rationale.
5. Reference any related GitHub issue numbers (e.g., `Closes #12`).

---

## 7. Security Vulnerabilities

If you discover a security vulnerability (such as exposed credentials, database injection risks, or bypasses in image forensics), please report it responsibly by contacting the project maintainers directly rather than opening a public issue.
