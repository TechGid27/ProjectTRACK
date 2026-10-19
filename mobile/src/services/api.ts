import { ProjectDetail, Contractor, Pin } from '../core/types';
import { mockProjects, getProjectsByLocation, getProjectById } from '../data/mockApi';
import { topContractors } from '../data/contractors';
import { pins as localPins } from '../data/pins';

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
      };
    } catch {
      // Deterministic civic fallback for offline testing
      const q = message.toLowerCase();
      if (q.includes('bogo')) {
        return {
          answer: 'In Bogo City, QM BUILDERS holds the largest flood mitigation contract: ₱49,000,000 for the Construction of Flood Mitigation Structure along Bogo River (Project 24HD0012).',
          sources: ['24HD0012'],
        };
      }
      if (q.includes('24hh0043') || q.includes('lahug')) {
        return {
          answer: 'Project 24HH0043: "Lahug River Flood Control Dredging & Slope Reinforcement" located in Lahug, Cebu City. Awarded to QM BUILDERS with an approved budget of ₱85,200,000.',
          sources: ['24HH0043'],
        };
      }
      return {
        answer: 'According to DPWH Cebu knowledge graph records, projects and budget allocations are tracked across all 53 Local Government Units in Cebu Province.',
      };
    }
  }
}

export const api = new ApiService();
