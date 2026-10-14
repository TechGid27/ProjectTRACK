import {
  exampleSummary,
  exampleTopContractors,
  exampleTopProjects,
  mockProjectById,
  mockProjectsByLocation,
  mockSearchProjects,
} from '../data/mockApi'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

async function request(path, fallback) {
  try {
    const res = await fetch(`${BASE_URL}/api${path}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch {
    return typeof fallback === 'function' ? fallback() : fallback
  }
}

export function fetchSummary() {
  return request('/analytics/summary', () => exampleSummary)
}

export function fetchTopContractors(limit = 3) {
  return request(
    `/analytics/top-contractors?limit=${limit}`,
    () => exampleTopContractors,
  )
}

export function fetchTopProjects(limit = 2) {
  return request(
    `/analytics/top-projects?limit=${limit}`,
    () => exampleTopProjects,
  )
}

export function fetchProjectsByLocation(location, limit = 5) {
  return request(
    `/projects/by-location?location=${encodeURIComponent(location)}&limit=${limit}`,
    () => mockProjectsByLocation(location),
  )
}

export function searchProjects(q, limit = 5) {
  return request(
    `/projects/search?q=${encodeURIComponent(q)}&limit=${limit}`,
    () => mockSearchProjects(),
  )
}

export function fetchProject(id) {
  return request(`/projects/${encodeURIComponent(id)}`, () =>
    mockProjectById(id),
  )
}
