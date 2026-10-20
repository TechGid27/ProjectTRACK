# Security Policy

## Supported Versions

| Component | Version | Supported |
| :--- | :--- | :---: |
| Backend (FastAPI) | 1.0.x | ✅ |
| Website (React 19 + Vite 8) | 0.x | ✅ |
| Mobile (Expo SDK 52) | 1.0.x | ✅ |

Only the latest release on the `development` and `main` branches receives security updates.

---

## Reporting a Vulnerability

**Do not open a public issue for security vulnerabilities.**

| Channel | Details |
| :--- | :--- |
| **Email** (preferred) | charliemangyao@gmail.com |
| **GitHub template** | [Report Vulnerability](https://github.com/kaids77/ProjectTRACK/issues/new?assignees=&labels=security&template=REPORT_VULNERABILITY.yaml) |

We will acknowledge your report within **72 hours** and provide a remediation timeline.

---

## Scope

The following areas are in scope for responsible disclosure:

* **Cypher injection** — any input path that can execute unintended Neo4j queries.
* **Prompt injection** — bypasses of the 5-layer domain guardrails in the GraphRAG engine.
* **Authentication bypass** — Supabase session token leakage, cookie tampering, or OAuth redirect manipulation.
* **Image forensics evasion** — methods to defeat Error Level Analysis (ELA) or GPS geofence validation.
* **Credential exposure** — API keys, database URIs, or tokens leaked via logs, responses, or client bundles.
* **CORS misconfiguration** — origins that should not be permitted access to credentialed endpoints.

---

## Responsible Disclosure Guidelines

* Provide enough information to reproduce and investigate the issue.
* Avoid accessing, modifying, or deleting data beyond what is necessary to demonstrate the vulnerability.
* Do not disclose vulnerabilities publicly before we have had a reasonable opportunity to address them.
* We commit to crediting reporters in the security advisory (unless you prefer anonymity).

---

## Architecture Reference

For details on the defense-in-depth architecture, 5-layer domain guardrails, Error Level Analysis (ELA) image forensics, prompt-injection hardening, and citizen privacy protections, see [docs/07-security.md](docs/07-security.md).

---

## Maintainers

* **Lead Maintainer**: Charlie C. Mangyao (`kaids77`)
* **Core Maintainer**: Gideon P. Ayao (`TechGid27`)
