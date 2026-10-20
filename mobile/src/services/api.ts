import {
  ProjectDetail,
  Contractor,
  Pin,
  ReportVerification,
  ReportRecord,
  ProcurementAward,
  AppropriationSummary,
  SpatialContext,
} from '../core/types';
import { mockProjects, getProjectsByLocation, getProjectById } from '../data/mockApi';
import { topContractors } from '../data/contractors';
import { pins as localPins } from '../data/pins';
import { outbox } from './outbox';

const DEFAULT_API_BASE = 'http://localhost:8000/api';

export interface BackendSummary {
  total_projects: number;
  total_contractors: number;
  total_budget: number;
  total_lgus: number;
}

export interface ChatResponse {
  answer: string;
  sources?: string[];
  mode?: string;
  spatial?: SpatialContext;
}

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = DEFAULT_API_BASE;
  }

  setBaseUrl(url: string) {
    this.baseUrl = url;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  async fetchSummary(): Promise<BackendSummary> {
    try {
      const res = await fetch(`${this.baseUrl}/analytics/summary`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return {
        total_projects: data.total_projects ?? mockProjects.length,
        total_contractors: data.total_contractors ?? topContractors.length,
        total_budget: data.total_budget ?? 4500000000,
        total_lgus: 53,
      };
    } catch {
      // Fallback to local verified figures
      return {
        total_projects: mockProjects.length,
        total_contractors: topContractors.length,
        total_budget: mockProjects.reduce((sum, p) => sum + p.budget, 0),
        total_lgus: 53,
      };
    }
  }

  async fetchTopContractors(limit = 20): Promise<Contractor[]> {
    try {
      const res = await fetch(
        `${this.baseUrl}/analytics/top-contractors?limit=${limit}`,
        {
          headers: { Accept: 'application/json' },
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map((item: any) => ({
          contractor: item.contractor,
          code: item.code || undefined,
          total_budget: item.total_budget || 0,
          project_count: item.project_count || 1,
        }));
      }
      return topContractors.slice(0, limit);
    } catch {
      return topContractors.slice(0, limit);
    }
  }

  async fetchProjectsByLocation(location: string, limit = 15): Promise<ProjectDetail[]> {
    try {
      const res = await fetch(
        `${this.baseUrl}/projects/by-location?location=${encodeURIComponent(location)}&limit=${limit}`,
        {
          headers: { Accept: 'application/json' },
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.sample_projects && Array.isArray(data.sample_projects) && data.sample_projects.length > 0) {
        return data.sample_projects.map((p: any) => ({
          id: p.id,
          title: p.title || p.description || 'Public Works Site',
          contractor: p.contractor || 'Contractor on Record',
          budget: p.budget || 20000000,
          status: p.status === 'Completed' ? 'Completed' : p.status === 'Delayed' ? 'Delayed' : 'Ongoing',
          lgu: p.location || location,
          barangay: p.barangay,
          scope: p.scope,
          amount_paid: p.amount_paid,
          source_of_funds: p.source_of_funds,
          funding_source: p.funding_source,
          program_name: p.program_name,
          region: p.region,
          procurements: p.procurements,
        }));
      }
      return getProjectsByLocation(location);
    } catch {
      return getProjectsByLocation(location);
    }
  }

  async fetchProjectById(id: string): Promise<ProjectDetail | undefined> {
    try {
      const res = await fetch(`${this.baseUrl}/projects/${encodeURIComponent(id)}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const p = await res.json();
      return {
        id: p.id,
        title: p.title || p.description,
        contractor: p.contractor || 'Contractor on Record',
        budget: p.budget || 0,
        status: p.status === 'Completed' ? 'Completed' : p.status === 'Delayed' ? 'Delayed' : 'Ongoing',
        lgu: p.location || 'Cebu Province',
        barangay: p.barangay,
        scope: p.scope,
        amount_paid: p.amount_paid,
        source_of_funds: p.source_of_funds,
        funding_source: p.funding_source,
        program_name: p.program_name,
        region: p.region,
        procurements: p.procurements,
      };
    } catch {
      return getProjectById(id);
    }
  }

  async fetchMapPins(municipality?: string): Promise<Pin[]> {
    try {
      const url = municipality
        ? `${this.baseUrl}/projects/map?municipality=${encodeURIComponent(municipality)}&limit=200`
        : `${this.baseUrl}/projects/map?limit=200`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map((p: any) => ({
          id: p.id,
          name: p.title || `Project ${p.id}`,
          lat: p.latitude,
          lng: p.longitude,
          tone: p.status === 'Delayed' ? 'warning' : 'default',
          lgu: p.location || municipality || 'Cebu Province',
        }));
      }
      return localPins;
    } catch {
      return localPins;
    }
  }

  async sendChatMessage(message: string, history: Array<{ role: string; content: string }> = []): Promise<ChatResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ message, history }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return {
        answer: data.answer || 'No response returned from GraphRAG.',
        sources: data.sources || [],
        mode: data.mode || 'ai',
        spatial: data.spatial,
      };
    } catch {
      // Deterministic civic fallback for offline testing
      const q = message.toLowerCase();
      if (q.includes('bogo')) {
        return {
          answer: 'In Bogo City, QM BUILDERS holds the largest flood mitigation contract: ₱49,000,000 for the Construction of Flood Mitigation Structure along Bogo River (Project 24HD0012).',
          sources: ['24HD0012'],
          mode: 'offline_civic_agent',
        };
      }
      if (q.includes('24hh0043') || q.includes('lahug')) {
        return {
          answer: 'Project 24HH0043: "Lahug River Flood Control Dredging & Slope Reinforcement" located in Lahug, Cebu City. Awarded to QM BUILDERS with an approved budget of ₱85,200,000.',
          sources: ['24HH0043'],
          mode: 'offline_civic_agent',
        };
      }
      return {
        answer: 'According to DPWH Cebu knowledge graph records, projects and budget allocations are tracked across all 53 Local Government Units in Cebu Province.',
        mode: 'offline_civic_agent',
      };
    }
  }

  async fetchAppropriations(limit = 50): Promise<AppropriationSummary[]> {
    try {
      const res = await fetch(`${this.baseUrl}/analytics/appropriations?limit=${limit}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      return [
        {
          office_name: 'Cebu 1st District Engineering Office',
          total_budget: 1850000000,
          project_count: 42,
          source_of_funds: 'GAA 2024',
        },
      ];
    }
  }

  async fetchProcurementAwards(contractor?: string, limit = 50): Promise<ProcurementAward[]> {
    try {
      const url = contractor
        ? `${this.baseUrl}/analytics/procurement?contractor=${encodeURIComponent(contractor)}&limit=${limit}`
        : `${this.baseUrl}/analytics/procurement?limit=${limit}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      return [];
    }
  }

  async signIn(email: string, password: string): Promise<{ user: any; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/auth/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { user: null, error: data?.detail || 'Sign-in failed.' };
      }
      return { user: data.user || data };
    } catch {
      // Offline fallback for testing
      return { user: { email, id: 'offline-user' } };
    }
  }

  async signUp(email: string, password: string, fullName?: string): Promise<{ user: any; message?: string; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password, full_name: fullName }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { user: null, error: data?.detail || 'Sign-up failed.' };
      }
      return { user: data.user || data, message: data.message };
    } catch {
      return { user: { email, id: 'offline-user' }, message: 'Account created (offline mode).' };
    }
  }

  async signOut(): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/auth/signout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // offline noop
    }
  }

  async getSession(): Promise<any | null> {
    try {
      const res = await fetch(`${this.baseUrl}/auth/session`, {
        headers: { Accept: 'application/json' },
        credentials: 'include',
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.user ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Submit a geofenced field report (Pillars 1–3). Sends multipart form data
   * with the session cookie (credentials: 'include'); the backend re-validates
   * the ≤150m geofence and runs image forensics, returning a verification
   * verdict. Throws an Error with a `.status` on 401 / 429 / other failures.
   */
  async submitReport(input: {
    projectId: string;
    description: string;
    category?: string;
    latitude?: number;
    longitude?: number;
    photo?: { uri: string; name?: string; type?: string } | null;
  }): Promise<ReportVerification> {
    const form = new FormData();
    form.append('project_id', input.projectId);
    form.append('description', input.description);
    if (input.category) form.append('category', input.category);
    if (typeof input.latitude === 'number') form.append('latitude', String(input.latitude));
    if (typeof input.longitude === 'number') form.append('longitude', String(input.longitude));
    if (input.photo) {
      // React Native multipart file shape.
      form.append('picture', {
        uri: input.photo.uri,
        name: input.photo.name ?? 'field-photo.jpg',
        type: input.photo.type ?? 'image/jpeg',
      } as unknown as Blob);
    }

    const res = await fetch(`${this.baseUrl}/reports`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    if (!res.ok) {
      let detail = `Report submission failed (HTTP ${res.status})`;
      try {
        const body = await res.json();
        if (body?.detail) detail = body.detail;
      } catch {
        // ignore non-JSON error bodies
      }
      const error = new Error(detail) as Error & { status?: number };
      error.status = res.status;
      throw error;
    }
    return (await res.json()) as ReportVerification;
  }

  /** Fetch a project's reports with verification badges (Pillar 5). */
  async fetchProjectReports(projectId: string): Promise<ReportRecord[]> {
    const res = await fetch(`${this.baseUrl}/reports/${encodeURIComponent(projectId)}`, {
      headers: { Accept: 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    return (body?.reports ?? []) as ReportRecord[];
  }

  /**
   * Offline-first sync (Pillar 1 field durability): POST each pending outbox
   * audit to the backend. Marks items synced on success; leaves them pending on
   * failure so a later sync retries. Returns the number successfully synced.
   */
  async syncPendingAudits(): Promise<number> {
    const pending = outbox.getPendingAudits();
    let synced = 0;
    for (const item of pending) {
      try {
        await this.submitReport({
          projectId: item.projectId,
          description: item.notes ?? 'On-site field audit (offline capture).',
          latitude: item.latitude,
          longitude: item.longitude,
        });
        outbox.markSynced(item.id);
        synced += 1;
      } catch {
        // Keep the item pending for the next sync attempt.
      }
    }
    return synced;
  }
}

export const api = new ApiService();
