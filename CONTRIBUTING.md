# Contributing to ProjectTrack

Thank you for your interest in **ProjectTrack** — a civic transparency platform dedicated to monitoring DPWH infrastructure projects across Cebu Province, Philippines.

We welcome contributions from software engineers, GIS specialists, data journalists, student researchers, and civic advocates.

* **Repository**: [github.com/kaids77/ProjectTRACK](https://github.com/kaids77/ProjectTRACK)
* **Lead Maintainer**: Charlie C. Mangyao (`kaids77`)
* **Core Maintainer**: Gideon P. Ayao (`TechGid27`)
* **Contact**: charliemangyao@gmail.com

---

## Code of Conduct

All participants are expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md). Please review it before opening issues or submitting pull requests.

---

## Getting Oriented

ProjectTrack is a monorepo with three main components:

| Component | Stack | Directory |
| :--- | :--- | :--- |
| **Backend** | Python 3.10+, FastAPI, Neo4j, Pydantic v2 | `backend/` |
| **Website** | React 19, Vite 8, Leaflet, Tailwind CSS v4 | `Website/` |
| **Mobile** | React Native 0.76, Expo SDK 52, TypeScript | `mobile/` |

Detailed setup instructions live in each component's README and in the [docs/](docs/) directory. Start with [docs/01-getting-started.md](docs/01-getting-started.md) for a full walkthrough.

---

## Branching and Workflow

We use a two-branch model:

* **`main`** — stable production releases only.
* **`development`** — the active integration branch. All work merges here first.

When starting new work, create a descriptive branch from `development`:

```bash
git checkout development
git pull origin development
git checkout -b feat/your-feature-name
```

Use prefixes that signal intent: `feat/`, `fix/`, `docs/`, `refactor/`, `test/`, or `chore/`.

---

## Code Quality Standards

Each component has its own tooling. Run the relevant checks before pushing:

### Backend (Python)

```bash
cd backend
flake8 backend/ --max-line-length=120 --exclude=__pycache__
black --check backend/
python -m pytest backend/tests/ -v
```

The backend follows **PEP 8** conventions with strict type hints on all public functions and **Pydantic v2** for payload validation.

### Website (JavaScript / React)

```bash
cd Website
npm run lint
npm run test
npm run build
```

Use React 19 functional components with hooks. Prefer Tailwind CSS utilities over inline styles. Keep cartographic assets lightweight (simplified GeoJSON).

### Mobile (TypeScript / Expo)

```bash
cd mobile
npm run lint
npm run typecheck
npm run test
```

Stick to Expo managed modules (`expo-location`, `expo-camera`, `expo-sqlite`) and the Haversine formula for geofencing logic.

---

## Writing Commits

We follow [Conventional Commits](https://www.conventionalcommits.org/) to keep the history navigable. Each commit subject should identify the scope so that anyone scanning `git log` knows which part of the system was affected.

```text
<type>(<scope>): <short description>

[optional body]

[optional footer(s)]
```

**Types**: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `style`, `ci`

**Scopes** (use the one closest to your change): `backend`, `web`, `mobile`, `map`, `chat`, `auth`, `neo4j`, `pipeline`, `deps`

Examples from this project:

* `feat(map): implement dynamic barangay layer switching at zoom level 12`
* `fix(backend): correct budget aggregate precision in analytics router`
* `docs(api): add response payload schemas for chat streaming endpoint`
* `test(auth): cover Supabase OAuth callback with mocked provider`
* `chore(deps): bump fastapi to 0.115.x and pin pydantic-settings`
* `refactor(mobile): optimize expo-sqlite transaction batching for offline sync`

---

## Submitting a Pull Request

1. **Target `development`** — PRs should not go directly to `main` unless it is an authorized production release.
2. **Sync first** — rebase or merge the latest `development` into your branch to avoid conflicts.
3. **Pass all checks** — ensure linters, formatters, and tests run cleanly before requesting review.
4. **Fill out the template** — use the [PR template](.github/PULL_REQUEST_TEMPLATE.md) and describe what you changed, the reasoning, and how you verified correctness.
5. **Link issues** — reference related GitHub issues (e.g., `Closes #42`) so they auto-close on merge.
6. **Update docs if needed** — see the [Keeping Documentation in Sync](#keeping-documentation-in-sync) section below.

---

## Keeping Documentation in Sync

Documentation must stay accurate as the codebase evolves. Use this reference to determine which files need attention when you change something:

| What changed | Update this |
| :--- | :--- |
| Root-level features or system capabilities | [README.md](README.md) |
| Backend CLI, pipeline, or services | [backend/Readme.md](backend/Readme.md) |
| API endpoints, auth, or environment config | [backend/backend/README.md](backend/backend/README.md) |
| Website capabilities or components | [Website/README.md](Website/README.md) |
| Mobile features or configuration | [mobile/Readme.md](mobile/Readme.md) |
| Deep design, architecture, or security | Relevant file in [docs/](docs/) |
| New environment variables | `.env.example` in the affected package |
| New or renamed API endpoints | [docs/05-api-reference.md](docs/05-api-reference.md) |

Be precise about what is implemented versus what is planned. If a feature is still in development, label it as such rather than presenting it as complete.

---

## Reporting Security Issues

If you discover a security vulnerability — such as exposed credentials, Cypher injection vectors, guardrail bypasses, or weaknesses in image forensics — **do not open a public issue**. Instead, report it privately to `charliemangyao@gmail.com` or use the [Report Vulnerability template](https://github.com/kaids77/ProjectTRACK/issues/new?assignees=&labels=security&template=REPORT_VULNERABILITY.yaml).

See the full [Security Policy](SECURITY.md) for scope, response timelines, and disclosure guidelines.
