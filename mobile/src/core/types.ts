export interface Pin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  tone?: 'default' | 'accent' | 'warning';
  lgu: string;
  description?: string;
}

export type ProjectStatus = 'Ongoing' | 'Completed' | 'Delayed';

export interface ProcurementAward {
  id: string;
  title: string;
  approved_budget?: number;
  contract_amount?: number;
  award_date?: string;
  contractor?: string;
  org_name?: string;
  area_of_delivery?: string;
  match_confidence?: string;
}

export interface AppropriationSummary {
  office_name: string;
  total_budget: number;
  project_count: number;
  source_of_funds?: string;
}

export interface SpatialContext {
  view_level?: string;
  center_lat?: number;
  center_lng?: number;
  zoom?: number;
  target_lgu?: string;
  focused_project_id?: string;
  highlight_project_ids?: string[];
}

export interface ProjectDetail {
  id: string;
  title: string;
  contractor: string;
  budget: number;
  status: ProjectStatus;
  lgu: string;
  barangay?: string;
  startDate?: string;
  targetCompletion?: string;
  scope?: string;
  amount_paid?: number;
  source_of_funds?: string;
  funding_source?: string;
  program_name?: string;
  region?: string;
  procurements?: ProcurementAward[];
}

export interface BoundingBox {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

export interface MunicipalityFeature {
  type: 'Feature';
  properties: {
    name: string;
    label: [number, number]; // [lng, lat]
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

export interface MunicipalityCollection {
  type: 'FeatureCollection';
  features: MunicipalityFeature[];
}

export type AnomalyCategory =
  | 'ghost_project'
  | 'delay'
  | 'substandard_materials'
  | 'other';

export interface AnomalyReport {
  id: string;
  projectId: string;
  category: AnomalyCategory;
  description: string;
  photoUri?: string;
  latitude?: number;
  longitude?: number;
  timestamp: number;
}

/**
 * Shared verification verdict returned by the backend (Pillar 5).
 * Mirrors backend/models/report.py ReportVerification + the website badges so
 * the two clients render identical badge semantics.
 */
export type ReportStatus = 'verified' | 'pending' | 'flagged' | 'rejected';
export type ForensicsVerdict = 'clean' | 'suspicious' | 'recycled';

export interface ReportVerification {
  id: string;
  project_id: string;
  status: ReportStatus;
  distance_meters: number | null;
  geofence_pass: boolean;
  ela_score: number | null;
  phash_recycled: boolean;
  forensics_verdict: ForensicsVerdict;
  reporter_reputation: number;
  created_at: string;
}

export interface ReportRecord extends ReportVerification {
  description: string;
  category: string;
  photo_url: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface LguSummary {
  name: string;
  totalProjects: number;
  totalBudget: number;
  activeProjects: number;
}

export interface Contractor {
  contractor: string;
  code?: string;
  total_budget: number;
  project_count: number;
}

export interface FaqItem {
  q: string;
  a: string;
}
