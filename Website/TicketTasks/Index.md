# ProjectTrack – Task Reminders & Development Roadmap

> **Note:** This `Index.md` is exclusively for tracking active tasks, feature priorities, and development goals for ProjectTrack.

---

## High Priority

- [ ] **2x Zoom Barangay Display & Labels**
  - [ ] Implement dynamic layer switching to show all Barangay boundaries and labels at 2x zoom level (~Zoom 12+).
  - [ ] Optimize polygon rendering and performance for all Cebu barangays.

- [ ] **GraphRAG Sample Data & Secure Fetching**
  - [ ] Generate and integrate sample project data structured for GraphRAG *(Execute after completing 2x Zoom)*.
  - [ ] Implement secure API endpoints/fetching mechanisms to retrieve all project data safely.

---

## Medium Priority

- [ ] **User Authentication**
  - [ ] Integrate **Google OAuth**.
  - [ ] Integrate **Facebook OAuth**.

- [ ] **People Initiative Feature**
  - [ ] Allow authenticated users/community members to submit, view, or support local initiatives.

---

## Core Map Logic & Interaction Rules

- [ ] **Pinpoint Click Behavior (District & Municipal Level)**
  - [ ] Apply the same project display logic used in Barangays to District and Municipal levels.
  - [ ] Clicking a district or municipal pinpoint should trigger a sidebar/modal listing all ongoing and completed projects in that area.

---

## Quality Assurance & Final Phase

- [ ] **End-to-End System Testing**
  - [ ] Test zoom-based layer switching smoothness and boundary accuracy.
  - [ ] Test authentication login flows and session security.
  - [ ] Verify data fetching performance and GraphRAG response accuracy.