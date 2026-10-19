import { api } from '../src/services/api';

describe('ApiService (FastAPI integration & offline fallback)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    api.setBaseUrl('http://localhost:8000/api');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('setBaseUrl and getBaseUrl update API endpoint', () => {
    api.setBaseUrl('http://192.168.1.50:8000/api');
    expect(api.getBaseUrl()).toBe('http://192.168.1.50:8000/api');
  });

  test('fetchSummary returns data on successful HTTP response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        total_projects: 1420,
        total_contractors: 68,
        total_budget: 8500000000,
      }),
    } as any);

    const summary = await api.fetchSummary();
    expect(summary.total_projects).toBe(1420);
    expect(summary.total_contractors).toBe(68);
    expect(summary.total_budget).toBe(8500000000);
    expect(summary.total_lgus).toBe(53);
  });

  test('fetchSummary gracefully falls back to local data if network fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network request failed'));

    const summary = await api.fetchSummary();
    expect(summary.total_projects).toBeGreaterThan(0);
    expect(summary.total_contractors).toBeGreaterThan(0);
    expect(summary.total_lgus).toBe(53);
  });

  test('fetchTopContractors returns parsed contractors on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { contractor: 'QM BUILDERS', code: 'QM', total_budget: 1500000000, project_count: 24 },
      ],
    } as any);

    const contractors = await api.fetchTopContractors(5);
    expect(contractors.length).toBe(1);
    expect(contractors[0].contractor).toBe('QM BUILDERS');
    expect(contractors[0].total_budget).toBe(1500000000);
  });

  test('fetchTopContractors falls back to local dataset on network error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Failed to connect'));

    const contractors = await api.fetchTopContractors(5);
    expect(contractors.length).toBe(5);
    expect(contractors[0].contractor).toBeDefined();
  });

  test('sendChatMessage sends prompt and returns parsed answer or offline fallback', async () => {
    // 1. Success case
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        answer: 'QM BUILDERS has 24 active flood mitigation projects in Cebu.',
        sources: ['DPWH Region VII Procurement Data'],
        mode: 'rag',
      }),
    } as any);

    const response = await api.sendChatMessage('Tell me about QM Builders');
    expect(response.answer).toContain('QM BUILDERS');
    expect(response.mode).toBe('rag');

    // 2. Offline fallback case
    global.fetch = jest.fn().mockRejectedValue(new Error('Connection refused'));
    const fallbackResponse = await api.sendChatMessage('How many projects in Bogo?');
    expect(fallbackResponse.answer).toBeDefined();
    expect(fallbackResponse.mode).toBe('offline_civic_agent');
  });
});
