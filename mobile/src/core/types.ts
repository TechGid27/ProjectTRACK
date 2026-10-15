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

export interface LguSummary {
  name: string;
  totalProjects: number;
  totalBudget: number;
  activeProjects: number;
}
