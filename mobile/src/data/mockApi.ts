import { topContractors } from './contractors';
import { ProjectDetail, LguSummary } from '../core/types';
import { normalizeLguName } from '../core/geoUtils';

export const mockProjects: ProjectDetail[] = [
  {
    id: '24HD0012',
    title: 'Construction of Flood Mitigation Structure along Bogo River, Bogo City, Cebu',
    contractor: 'QM BUILDERS',
    budget: 49000000,
    status: 'Ongoing',
    lgu: 'Bogo City',
    barangay: 'Cogon',
    startDate: '2024-02-15',
    targetCompletion: '2024-11-30',
    scope: 'Reinforced concrete revetment wall, sheet piling, and drainage canal outfall.',
  },
  {
    id: '24HD0045',
    title: 'Rehabilitation of Asphalt Pavement along Bogo-Curva-Medellin Road',
    contractor: 'FIRST GRANDEUR BUILDERS',
    budget: 28420000,
    status: 'Completed',
    lgu: 'Bogo City',
    barangay: 'Lourdes',
    startDate: '2023-09-01',
    targetCompletion: '2024-03-15',
    scope: 'Asphalt overlay (50mm), re-blocking of damaged concrete slabs, and thermoplastic markings.',
  },
  {
    id: '24HD0051',
    title: 'Construction of Flood Control Structure along Dakit Creek, Bogo City',
    contractor: 'QM BUILDERS',
    budget: 35600000,
    status: 'Ongoing',
    lgu: 'Bogo City',
    barangay: 'Dakit',
    startDate: '2024-04-10',
    targetCompletion: '2025-01-20',
    scope: 'Boulder riprap slope protection and concrete lined ditch.',
  },
  {
    id: '24HD0033',
    title: 'Rehabilitation of Farm-to-Market Road, Bogo City to San Remigio Boundary',
    contractor: 'WTG CONSTRUCTION & DEVELOPMENT CORP.',
    budget: 62150000,
    status: 'Delayed',
    lgu: 'Bogo City',
    barangay: 'Don Pedro',
    startDate: '2023-11-01',
    targetCompletion: '2024-06-30',
    scope: 'Concreting of 4.2km gravel road including pipe culverts and drainage.',
  },
  {
    id: '24HH0043',
    title: 'Lahug River Flood Control Dredging & Slope Reinforcement',
    contractor: 'QM BUILDERS',
    budget: 85200000,
    status: 'Ongoing',
    lgu: 'Cebu City',
    barangay: 'Lahug',
    startDate: '2024-01-15',
    targetCompletion: '2024-12-15',
    scope: 'Desilting, sheet pile driving, and pedestrian retaining wall.',
  },
  {
    id: '23H00018',
    title: 'Metro Cebu Expressway Package 3, Naga-Minglanilla Section',
    contractor: 'WTG CONSTRUCTION & DEVELOPMENT CORP.',
    budget: 985000000,
    status: 'Ongoing',
    lgu: 'City of Naga',
    barangay: 'Inoburan',
    startDate: '2023-03-01',
    targetCompletion: '2025-12-31',
    scope: '4-lane arterial expressway construction, viaducts, and slope stabilization.',
  },
  {
    id: '24H00002',
    title: 'Construction of 4-Lane Flyover along UN Avenue, Mandaue City',
    contractor: 'QM BUILDERS',
    budget: 742000000,
    status: 'Delayed',
    lgu: 'Mandaue City',
    barangay: 'Umapad',
    startDate: '2023-06-01',
    targetCompletion: '2024-08-30',
    scope: 'Prestressed concrete girder flyover, approach roads, and signalization.',
  },
  {
    id: '24HD0028',
    title: 'Construction of Multi-Purpose Building, Barangay Libertad, Bogo City',
    contractor: 'ZL2 BUILDERS',
    budget: 8750000,
    status: 'Completed',
    lgu: 'Bogo City',
    barangay: 'Libertad',
    startDate: '2023-08-15',
    targetCompletion: '2024-02-15',
    scope: '2-storey standard public evacuation center with medical clinic room.',
  },
  {
    id: '24HD0060',
    title: 'Repair and Rehabilitation of Drainage along Bogo National Highway',
    contractor: 'PLD CONSTRUCTION',
    budget: 15300000,
    status: 'Ongoing',
    lgu: 'Bogo City',
    barangay: 'Gairan',
    startDate: '2024-05-01',
    targetCompletion: '2024-10-31',
    scope: 'Pre-cast RC box culverts and curb inlets.',
  },
  {
    id: '24HD0019',
    title: 'Construction of Slope Protection Structure along Bogo River',
    contractor: 'FIRST GRANDEUR BUILDERS',
    budget: 22900000,
    status: 'Completed',
    lgu: 'Bogo City',
    barangay: 'Marangog',
    startDate: '2023-07-01',
    targetCompletion: '2023-12-20',
    scope: 'Gabion mattresses and stone masonry retaining wall.',
  },
];

export function getProjectsByLocation(locationQuery: string): ProjectDetail[] {
  const query = locationQuery.trim().toLowerCase();
  if (!query) return mockProjects;
  return mockProjects.filter((proj) => {
    const lguNorm = normalizeLguName(proj.lgu).toLowerCase();
    const bgyNorm = (proj.barangay || '').toLowerCase();
    const titleNorm = proj.title.toLowerCase();
    return (
      lguNorm.includes(query) ||
      bgyNorm.includes(query) ||
      titleNorm.includes(query)
    );
  });
}

export function getProjectById(id: string): ProjectDetail | undefined {
  return mockProjects.find((p) => p.id === id);
}

export function computeLguSummary(lguName: string): LguSummary {
  const normalized = normalizeLguName(lguName);
  const matched = getProjectsByLocation(normalized);

  const totalBudget = matched.reduce((sum, p) => sum + p.budget, 0);
  const activeProjects = matched.filter((p) => p.status === 'Ongoing').length;

  return {
    name: normalized,
    totalProjects: matched.length,
    totalBudget,
    activeProjects,
  };
}

export function getTopContractors(limit: number = 20) {
  return (topContractors || []).slice(0, limit);
}

export function getSystemSummary() {
  return {
    total_projects: mockProjects.length,
    total_lgus: 53,
    total_cities: 9,
    total_municipalities: 44,
  };
}
