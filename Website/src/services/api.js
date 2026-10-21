const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

const GET_CACHE = new Map()
const INFLIGHT = new Map()

export function clearApiCache() {
  GET_CACHE.clear()
  INFLIGHT.clear()
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      Accept: 'application/json',
      ...(typeof options.body === 'string'
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...options.headers,
    },
  })
  let body
  try {
    body = await res.json()
  } catch {
    body = null
  }
  if (!res.ok) {
    const detail = body?.detail
    const error = new Error(
      typeof detail === 'string' ? detail : `Request failed (HTTP ${res.status})`,
    )
    error.status = res.status
    throw error
  }
  return body
}

function cachedGet(path, ttlMs) {
  const now = Date.now()
  const hit = GET_CACHE.get(path)
  if (hit && hit.expires > now) return Promise.resolve(hit.data)
  if (INFLIGHT.has(path)) return INFLIGHT.get(path)
  const promise = request(path)
    .then((data) => {
      GET_CACHE.set(path, { data, expires: now + ttlMs })
      return data
    })
    .finally(() => {
      INFLIGHT.delete(path)
    })
  INFLIGHT.set(path, promise)
  return promise
}

export function fetchSummary() {
  return cachedGet('/analytics/summary', 60_000)
}

export function fetchTopContractors(limit = 3) {
  return request(`/analytics/top-contractors?limit=${limit}`)
}

export function fetchTopProjects(limit = 2) {
  return request(`/analytics/top-projects?limit=${limit}`)
}

export function fetchProjectsByLocation(location, limit = 5) {
  return request(
    `/projects/by-location?location=${encodeURIComponent(location)}&limit=${limit}`,
  )
}

export function searchProjects(q, limit = 5) {
  return request(`/projects/search?q=${encodeURIComponent(q)}&limit=${limit}`)
}

export function fetchProject(id) {
  return request(`/projects/${encodeURIComponent(id)}`)
}

export function fetchMapPoints(limit = 500, municipality = null) {
  const params = new URLSearchParams({ limit: String(limit) })
  if (municipality) params.set('municipality', municipality)
  return cachedGet(`/projects/map?${params}`, 60_000)
}

export async function submitAnomalyReport({
  projectId,
  description,
  location,
  reporterName,
  category,
  latitude,
  longitude,
  picture,
}) {
  const formData = new FormData()
  formData.append('project_id', projectId)
  formData.append('description', description)
  if (location) formData.append('location', location)
  if (reporterName) formData.append('reporter_name', reporterName)
  if (category) formData.append('category', category)
  // Browser geolocation is lower-trust than mobile hardware GPS; the backend
  // re-validates the ≤150m geofence against the project's DPWH coordinates.
  if (typeof latitude === 'number') formData.append('latitude', String(latitude))
  if (typeof longitude === 'number') formData.append('longitude', String(longitude))
  if (picture) formData.append('picture', picture)

  return request('/reports', {
    method: 'POST',
    body: formData,
  })
}

export function fetchProjectReports(projectId) {
  return request(`/reports/${encodeURIComponent(projectId)}`)
}

export async function postChatMessage({
  message,
  mode = 'ai',
  history = [],
}) {
  return request('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, mode, history }),
  })
}

export async function streamChatMessage({
  message,
  mode = 'ai',
  history = [],
  onEvent,
  signal,
}) {
  const res = await fetch(`${BASE_URL}/api/chat/stream`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({ message, mode, history }),
    signal,
  })
  if (res.status === 404 || res.status === 501) {
    const data = await postChatMessage({ message, mode, history }).catch(
      () => null,
    )
    if (data) {
      if (data.spatial) onEvent('context', { spatial: data.spatial })
      if (data.answer) onEvent('token', { token: data.answer })
      onEvent('done', { status: 'completed' })
      return
    }
  }
  if (!res.ok) {
    const error = new Error(`Chat request failed (HTTP ${res.status})`)
    error.status = res.status
    throw error
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let separator
    while ((separator = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, separator)
      buffer = buffer.slice(separator + 2)
      let event = 'message'
      let data = ''
      for (const line of raw.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data += line.slice(5).trim()
      }
      if (!data) continue
      try {
        onEvent(event, JSON.parse(data))
      } catch {
        // ignore malformed frames
      }
    }
  }
}
