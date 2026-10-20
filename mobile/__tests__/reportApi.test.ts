import { api } from '../src/services/api';
import { outbox } from '../src/services/outbox';

describe('ApiService report submission (Pillars 1-3)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    api.setBaseUrl('http://localhost:8000/api');
    outbox.clearQueue();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('submitReport posts multipart with credentials and returns the verdict', async () => {
    const verdict = {
      id: 'r1',
      project_id: '24HD0012',
      status: 'verified',
      distance_meters: 45,
      geofence_pass: true,
      forensics_verdict: 'clean',
      reporter_reputation: 59,
      created_at: '2026-10-20T12:00:00+00:00',
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => verdict,
    }) as any;

    const result = await api.submitReport({
      projectId: '24HD0012',
      description: 'On-site audit within 45m of the project centroid.',
      latitude: 11.0509,
      longitude: 124.0055,
    });

    expect(result.status).toBe('verified');
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/api/reports');
    expect(options.method).toBe('POST');
    expect(options.credentials).toBe('include');
    expect(options.body).toBeInstanceOf(FormData);
  });

  test('submitReport throws with .status on a 429 rate limit', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ detail: 'Daily report limit reached (3 per 24 hours).' }),
    }) as any;

    await expect(
      api.submitReport({ projectId: '24HD0012', description: 'Fourth report today.' }),
    ).rejects.toMatchObject({ status: 429 });
  });

  test('fetchProjectReports returns the reports array', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ project_id: '24HD0012', count: 1, reports: [{ id: 'r1' }] }),
    }) as any;

    const reports = await api.fetchProjectReports('24HD0012');
    expect(reports).toHaveLength(1);
    expect(reports[0].id).toBe('r1');
  });

  test('syncPendingAudits marks items synced on success', async () => {
    outbox.enqueueAudit({
      projectId: '24HD0012',
      latitude: 11.0509,
      longitude: 124.0055,
      distanceMeters: 45,
    });
    expect(outbox.getPendingCount()).toBe(1);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 'r1', status: 'verified' }),
    }) as any;

    const synced = await api.syncPendingAudits();
    expect(synced).toBe(1);
    expect(outbox.getPendingCount()).toBe(0);
  });

  test('syncPendingAudits leaves items pending when the network fails', async () => {
    outbox.enqueueAudit({
      projectId: '24HD0012',
      latitude: 11.0509,
      longitude: 124.0055,
      distanceMeters: 45,
    });

    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as any;

    const synced = await api.syncPendingAudits();
    expect(synced).toBe(0);
    expect(outbox.getPendingCount()).toBe(1);
  });
});
