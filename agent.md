# AI Agent Guidelines: ProjectTRACK

## 1. Golden Rule: Conventional Commits Requirement

> [!IMPORTANT]
> **EVERY CHANGE MUST BE COMMITTED USING CONVENTIONAL COMMITS.**
> Any modifications to code, documentation, tests, or configurations must conclude with a Git commit conforming to the [Conventional Commits](https://www.conventionalcommits.org/) specification.

---

## 2. Commit Message Structure

```text
<type>(<scope>): <short summary in imperative mood>

[optional body explaining motivation and key changes]

[optional footer(s), e.g., references to issues]
```

### Commit Types

| Type | Purpose | Example |
| :--- | :--- | :--- |
| **`feat`** | A new feature or user-facing capability | `feat(chat): add streaming AI copilot with interactive project chips` |
| **`fix`** | A bug fix or defect resolution | `fix(map): isolate municipality project queries to eliminate cross-LGU leakage` |
| **`docs`** | Documentation changes only | `docs(readme): update setup instructions for Neo4j and Groq API keys` |
| **`refactor`** | Code changes that neither fix a bug nor add a feature | `refactor(context): unify camera target and spatial context state` |
| **`perf`** | Performance improvements | `perf(neo4j): optimize spatial bounding box and batch index updates` |
| **`test`** | Adding, fixing, or updating unit/integration tests | `test(api): add unit tests for /api/chat spatial context payload` |
| **`chore`** | Maintenance, tooling, build system, or dependencies | `chore(deps): bump vite and tailwindcss dependencies` |
| **`style`** | Code formatting, linting fixes, no logic changes | `style(map): format marker definitions and remove unused imports` |
| **`ci`** | CI/CD pipeline or deployment workflow changes | `ci(github): add automated test and lint workflow` |

### Recommended Scopes

Use specific, descriptive scopes corresponding to the project architecture:

- **`map`**: Leaflet map components, layers, pin rendering, camera controller (`CebuMap`, `MapContext`, `BarangayLayer`).
- **`chat`**: AI chat copilot, SSE streaming, prompt engineering, instant lookup (`ChatCopilot`, `chat.py`).
- **`backend`**: FastAPI endpoints, router configuration, application lifecycle.
- **`neo4j`**: Graph schema, Cypher queries, graph aggregations (`neo4j_service.py`).
- **`pipeline`**: Scraping, GPS enrichment, geocoding engines (`enrich_neo4j_gps.py`, `geocoding.py`).
- **`web`**: General frontend layout, header, navigation, styling (`Website`).
- **`mobile`**: React Native / Expo mobile application (`mobile`).

---

## 3. Workflow & Best Practices for Agents

1. **Verify Before Committing**:
   - Always run the relevant tests and linters before committing:
     - Frontend: `npm run lint` and `npm run build` in `Website/`
     - Backend: `python -m unittest discover -s backend/backend/tests -p "test_*.py"`
2. **Keep Commits Atomic**:
   - Group related changes into logical commits. Do not bundle unrelated refactors with bug fixes.
3. **Imperative, Present-Tense Subject**:
   - Write `"add feature"` instead of `"added feature"` or `"adds feature"`.
   - Do not capitalize the first letter of the subject line after the colon.
   - Do not place a period (`.`) at the end of the subject line.
4. **Clean Working Tree**:
   - Never commit scratch scripts, temporary dumps, or log files.
   - Ensure `.gitignore` rules are respected.
