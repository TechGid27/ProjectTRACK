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

  test('fetchTopProjects returns high impact projects', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: '24HH0043',
          description: 'Lahug River Dredging',
          contractor: 'QM BUILDERS',
          budget_num: 85200000,
          location: 'Cebu City',
        },
      ],
    } as any);

    const projs = await api.fetchTopProjects(5);
    expect(projs.length).toBe(1);
    expect(projs[0].id).toBe('24HH0043');
    expect(projs[0].budget).toBe(85200000);
  });

  test('searchProjects sanitizes malicious input before querying backend', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          entity: '24HD0012',
          description: 'Bogo River Flood Control',
          budget_num: 49000000,
          municipality: 'Bogo City',
        },
      ],
    } as any);
    global.fetch = mockFetch;

    const results = await api.searchProjects('<script>alert(1)</script>bogo; DROP TABLE projects; --');
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('24HD0012');

    // Confirm URL was sanitized and stripped of injection characters
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).not.toContain('<script>');
    expect(calledUrl).not.toContain(';');
    expect(calledUrl).not.toContain('--');
  });

  test('fetchProjectsByLocation handles backend projects payload', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        location: 'Bogo City',
        total_count: 1,
        total_budget: 49000000,
        projects: [
          {
            entity: '24HD0012',
            description: 'Flood Control along Bogo River',
            contractor: 'QM BUILDERS',
            budget_num: 49000000,
            status: 'Ongoing',
            municipality: 'Bogo City',
          },
        ],
      }),
    } as any);

    const projects = await api.fetchProjectsByLocation('Bogo City');
    expect(projects.length).toBe(1);
    expect(projects[0].id).toBe('24HD0012');
    expect(projects[0].budget).toBe(49000000);
    expect(projects[0].lgu).toBe('Bogo City');
  });
});
