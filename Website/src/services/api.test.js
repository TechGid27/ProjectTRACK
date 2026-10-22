import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearApiCache,
  fetchProject,
  fetchProjectReports,
  fetchSummary,
  submitAnomalyReport,
} from './api'

describe('api service', () => {
  beforeEach(() => {
    clearApiCache()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetchProject returns live backend data on success', async () => {
    const payload = { id: '24HH0043', description: 'Flood control' }
    fetch.mockResolvedValue({
      ok: true,
      json: async () => payload,
    })
    const result = await fetchProject('24HH0043')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/projects/24HH0043'),
      expect.anything(),
    )
    expect(result).toEqual(payload)
  })

  it('every request sends cookies via credentials: include', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({}) })
    await fetchSummary()
    const [, options] = fetch.mock.calls[0]
    expect(options.credentials).toBe('include')
  })

  it('fetchProject throws when the backend is unreachable', async () => {
    fetch.mockRejectedValue(new Error('network down'))
    await expect(fetchProject('24HH0043')).rejects.toThrow('network down')
  })

  it('fetchProject surfaces backend error details', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ detail: 'Project not found' }),
    })
    await expect(fetchProject('NOPE')).rejects.toThrow('Project not found')
  })

  it('fetchProjectReports throws instead of faking an empty list', async () => {
    fetch.mockResolvedValue({ ok: false, status: 500 })
    await expect(fetchProjectReports('24HH0043')).rejects.toThrow(
      /HTTP 500/,
    )
  })

  it('submitAnomalyReport posts multipart form data and returns the saved report', async () => {
    const saved = { id: 'abc123', project_id: '24HH0043' }
    fetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => saved,
    })
    const result = await submitAnomalyReport({
      projectId: '24HH0043',
      description: 'No equipment on site despite full budget release.',
      location: 'Mandaue City',
    })
    expect(result).toEqual(saved)
    const [url, options] = fetch.mock.calls[0]
    expect(url).toContain('/api/reports')
    expect(options.method).toBe('POST')
    expect(options.credentials).toBe('include')
    expect(options.body).toBeInstanceOf(FormData)
    expect(options.body.get('project_id')).toBe('24HH0043')
    expect(options.headers.Authorization).toBeUndefined()
    // No GPS supplied → fields omitted so backend tags unverified_no_gps.
    expect(options.body.get('latitude')).toBeNull()
    expect(options.body.get('longitude')).toBeNull()
  })

  it('submitAnomalyReport appends GPS coordinates when provided', async () => {
    const saved = {
      id: 'def456',
      project_id: '24HH0043',
      geofence_status: 'inside',
      distance_meters: 45,
      badge: { label: 'On-Site Verified', tone: 'success' },
    }
    fetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => saved,
    })
    const result = await submitAnomalyReport({
      projectId: '24HH0043',
      description: 'On-site observation with GPS verification enabled here.',
      latitude: 10.3287,
      longitude: 123.9286,
    })
    expect(result.badge).toEqual({ label: 'On-Site Verified', tone: 'success' })
    const [, options] = fetch.mock.calls[0]
    expect(options.body.get('latitude')).toBe('10.3287')
    expect(options.body.get('longitude')).toBe('123.9286')
  })

  it('submitAnomalyReport omits partial GPS (latitude only)', async () => {
    fetch.mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 'x' }) })
    await submitAnomalyReport({
      projectId: '24HH0043',
      description: 'Only one coordinate was captured by the client somehow.',
      latitude: 10.3287,
    })
    const [, options] = fetch.mock.calls[0]
    expect(options.body.get('latitude')).toBeNull()
    expect(options.body.get('longitude')).toBeNull()
  })

  it('submitAnomalyReport throws on server errors', async () => {
    fetch.mockResolvedValue({ ok: false, status: 422 })
    await expect(
      submitAnomalyReport({
        projectId: '24HH0043',
        description: 'Too short.',
      }),
    ).rejects.toThrow(/HTTP 422/)
  })

  it('submitAnomalyReport attaches latitude/longitude and category', async () => {
    fetch.mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 'x' }) })
    await submitAnomalyReport({
      projectId: '24HH0043',
      description: 'Concrete works do not match the posted scope here.',
      category: 'ghost_project',
      latitude: 11.0509,
      longitude: 124.0055,
    })
    const [, options] = fetch.mock.calls[0]
    expect(options.body.get('latitude')).toBe('11.0509')
    expect(options.body.get('longitude')).toBe('124.0055')
    expect(options.body.get('category')).toBe('ghost_project')
  })

  it('surfaces FastAPI validation (array) detail messages', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        detail: [
          {
            loc: ['body', 'description'],
            msg: 'String should have at least 10 characters',
            type: 'string_too_short',
          },
        ],
      }),
    })
    await expect(
      submitAnomalyReport({
        projectId: '24HH0043',
        description: 'too short',
      }),
    ).rejects.toThrow(/description: String should have at least 10 characters/)
  })

  it('submitAnomalyReport surfaces a 429 rate-limit error', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ detail: 'Daily report limit reached (3 per 24 hours).' }),
    })
    await expect(
      submitAnomalyReport({
        projectId: '24HH0043',
        description: 'This is my fourth report in the same day window.',
      }),
    ).rejects.toMatchObject({ status: 429 })
  })
})
