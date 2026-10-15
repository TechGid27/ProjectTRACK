export const exampleSummary = {
  total_projects: 4370,
  total_budget: 87425120450.0,
  total_budget_formatted: '₱ 87.43B',
  total_contractors: 312,
  average_project_cost: 20005748.39,
}

export const exampleTopContractors = [
  {
    contractor: 'QM BUILDERS',
    code: '7494',
    project_count: 142,
    total_budget: 5890000000.0,
    total_budget_formatted: '₱ 5.89B',
  },
  {
    contractor: 'WTG CONSTRUCTION & DEVELOPMENT CORP.',
    code: '1284',
    project_count: 98,
    total_budget: 4120000000.0,
    total_budget_formatted: '₱ 4.12B',
  },
  {
    contractor: 'FIRST GRANDEUR BUILDERS',
    code: '3391',
    project_count: 76,
    total_budget: 2980000000.0,
    total_budget_formatted: '₱ 2.98B',
  },
]

export const exampleTopProjects = [
  {
    id: '23H00018',
    budget: '₱ 985,000,000.00',
    budget_num: 985000000.0,
    description:
      'Metro Cebu Expressway (Cebu Circumferential Road), Package 3, Naga-Minglanilla Section',
    contractor: 'WTG CONSTRUCTION & DEVELOPMENT CORP.',
    location: 'City of Naga, Cebu',
  },
  {
    id: '24H00002',
    budget: '₱ 742,000,000.00',
    budget_num: 742000000.0,
    description:
      'Construction of 4-Lane Flyover along UN Avenue, Mandaue City, Cebu',
    contractor: 'QM BUILDERS',
    location: 'Mandaue City',
  },
]

function peso(n) {
  return `₱ ${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function pesoTotal(n) {
  if (n >= 1e9) return `₱ ${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `₱ ${(n / 1e6).toFixed(2)}M`
  return peso(n)
}

const CONTRACTOR_CODES = {
  'QM BUILDERS': '7494',
  'WTG CONSTRUCTION & DEVELOPMENT CORP.': '1284',
  'FIRST GRANDEUR BUILDERS': '3391',
  'ZL2 BUILDERS': '41829',
  'PLD CONSTRUCTION': '5521',
}

const DISTRICT_OFFICES = {
  'Bogo City': 'Cebu First District Engineering Office',
  'Mandaue City': 'Cebu Second District Engineering Office',
  'Cebu City': 'Cebu City District Engineering Office',
  'City of Naga, Cebu': 'Cebu Second District Engineering Office',
  'Barangay Mabolo, Cebu City': 'Cebu City District Engineering Office',
}

function guessCategory(description) {
  if (/flood|drainage|slope|coastal|creek/i.test(description)) {
    return 'Flood Control / Drainage'
  }
  if (/building|school|health station|multi-purpose/i.test(description)) {
    return 'Buildings and Other Structures'
  }
  if (/solar|street light|footbridge/i.test(description)) {
    return 'Other Infrastructure'
  }
  return 'Roads (Construction/Rehabilitation)'
}

function proj(
  entity,
  description,
  budget_num,
  status,
  contractor,
  location,
  coords,
) {
  return {
    entity,
    labels: ['Project'],
    description,
    budget: peso(budget_num),
    budget_num,
    status,
    url: `https://bettergov.ph/dpwh/cebu/${entity}`,
    score: 1.0,
    lat: coords ? coords[0] : null,
    lng: coords ? coords[1] : null,
    timeline: '120 Calendar Days',
    office: DISTRICT_OFFICES[location] ?? 'Cebu District Engineering Office',
    category: guessCategory(description),
    contractor_code: CONTRACTOR_CODES[contractor] ?? '00000',
    relations: [
      { rel: 'LOCATED_IN', target: location, desc: location },
      { rel: 'CONTRACTED_TO', target: contractor, desc: contractor },
    ],
  }
}

export function lguQuery(name) {
  return name.replace(/^City of /, '').replace(/ City$/, '')
}

const QM = 'QM BUILDERS'
const WTG = 'WTG CONSTRUCTION & DEVELOPMENT CORP.'
const FGB = 'FIRST GRANDEUR BUILDERS'
const ZL2 = 'ZL2 BUILDERS'
const PLD = 'PLD CONSTRUCTION'

const SAMPLE_LOCATIONS = [
  {
    keys: ['bogo'],
    projects: [
      proj(
        '24HD0012',
        'Construction of Flood Mitigation Structure along Bogo River, Bogo City, Cebu',
        49000000,
        'Ongoing',
        QM,
        'Bogo City',
        [11.062, 124.001],
      ),
      proj(
        '24HD0045',
        'Rehabilitation of Asphalt Pavement along Bogo-Curva-Medellin Road',
        28420000,
        'Completed',
        FGB,
        'Bogo City',
        [11.078, 123.978],
      ),
      proj(
        '24HD0051',
        'Construction of Flood Control Structure along Dakit Creek, Bogo City',
        35600000,
        'Ongoing',
        QM,
        'Bogo City',
        [11.043, 124.022],
      ),
      proj(
        '24HD0033',
        'Rehabilitation of Farm-to-Market Road, Bogo City to San Remigio Boundary',
        62150000,
        'Ongoing',
        WTG,
        'Bogo City',
        [11.093, 123.972],
      ),
      proj(
        '24HD0028',
        'Construction of Multi-Purpose Building, Barangay Libertad, Bogo City',
        8750000,
        'Completed',
        ZL2,
        'Bogo City',
        [11.049, 123.994],
      ),
      proj(
        '24HD0060',
        'Repair/Rehabilitation of Drainage along Bogo National Highway',
        15300000,
        'Ongoing',
        PLD,
        'Bogo City',
        [11.056, 124.014],
      ),
      proj(
        '24HD0019',
        'Construction of Slope Protection Structure along Bogo River, Bogo City',
        22900000,
        'Completed',
        FGB,
        'Bogo City',
        [11.069, 123.989],
      ),
      proj(
        '24HD0072',
        'Supply and Installation of Solar Street Lights, Bogo City',
        6480000,
        'Ongoing',
        QM,
        'Bogo City',
        [11.037, 124.004],
      ),
    ],
  },
  {
    keys: ['mandaue'],
    projects: [
      proj(
        '24H00002',
        'Construction of 4-Lane Flyover along UN Avenue, Mandaue City, Cebu',
        742000000,
        'Ongoing',
        QM,
        'Mandaue City',
        [10.334, 123.951],
      ),
      proj(
        '24H00015',
        'Construction of Drainage System along A.S. Fortuna Street, Mandaue City',
        58200000,
        'Ongoing',
        QM,
        'Mandaue City',
        [10.356, 123.947],
      ),
      proj(
        '24H00027',
        'Rehabilitation of Road Network, Mandaue City (Phase II)',
        96500000,
        'Ongoing',
        WTG,
        'Mandaue City',
        [10.339, 123.972],
      ),
      proj(
        '24H00009',
        'Construction of Footbridge along UN Avenue, Mandaue City',
        12300000,
        'Completed',
        ZL2,
        'Mandaue City',
        [10.329, 123.957],
      ),
    ],
  },
  {
    keys: ['cebu city', 'cebu'],
    projects: [
      proj(
        '24HH0043',
        'Construction (Completion) of Multi-Purpose Building, Barangay Mabolo, Cebu City',
        4950000,
        'Completed',
        ZL2,
        'Barangay Mabolo, Cebu City',
        [10.326, 123.9],
      ),
      proj(
        '24HH0051',
        'Construction of School Building, Barangay Basak, Cebu City',
        18600000,
        'Ongoing',
        FGB,
        'Cebu City',
        [10.303, 123.897],
      ),
      proj(
        '24HH0022',
        'Rehabilitation of Road, Barangay Guadalupe, Cebu City',
        41750000,
        'Ongoing',
        QM,
        'Cebu City',
        [10.334, 123.873],
      ),
      proj(
        '24HH0067',
        'Construction of Health Station, Barangay Mambaling, Cebu City',
        7900000,
        'Completed',
        ZL2,
        'Cebu City',
        [10.295, 123.89],
      ),
    ],
  },
  {
    keys: ['naga'],
    projects: [
      proj(
        '23H00018',
        'Metro Cebu Expressway (Cebu Circumferential Road), Package 3, Naga-Minglanilla Section',
        985000000,
        'Ongoing',
        WTG,
        'City of Naga, Cebu',
        [10.26, 123.79],
      ),
      proj(
        '24H00031',
        'Construction of Coastal Protection Structure, City of Naga, Cebu',
        87400000,
        'Ongoing',
        WTG,
        'City of Naga, Cebu',
        [10.19, 123.74],
      ),
    ],
  },
]

export function mockProjectsByLocation(location) {
  const query = String(location).toLowerCase().trim()
  const sample = SAMPLE_LOCATIONS.find((entry) =>
    entry.keys.some((key) => query === key || query.includes(key)),
  )
  if (!sample) {
    return {
      location,
      total_count: 0,
      total_budget: 0,
      total_budget_formatted: '₱ 0',
      showing_count: 0,
      projects: [],
    }
  }
  const total_budget = sample.projects.reduce(
    (sum, project) => sum + project.budget_num,
    0,
  )
  return {
    location,
    total_count: sample.projects.length,
    total_budget,
    total_budget_formatted: pesoTotal(total_budget),
    showing_count: sample.projects.length,
    projects: sample.projects,
  }
}

export function mockSearchProjects() {
  return [
    proj(
      '24HD0045',
      'Preventive Maintenance / Asphalt Overlay along Cebu North Hagnaya Wharf Rd',
      34250000,
      'Ongoing',
      PLD,
      'Cebu North Hagnaya Wharf Rd',
    ),
  ]
}

export function projectContractor(project) {
  return project.relations?.find((r) => r.rel === 'CONTRACTED_TO')?.target ?? null
}

export function projectLocation(project) {
  return project.relations?.find((r) => r.rel === 'LOCATED_IN')?.target ?? null
}

export function mockProjectById(id) {
  const project = SAMPLE_LOCATIONS.flatMap((entry) => entry.projects).find(
    (p) => p.entity === id,
  )
  if (!project) return null
  return {
    id: project.entity,
    description: project.description,
    budget: project.budget,
    budget_num: project.budget_num,
    status: project.status,
    timeline: project.timeline,
    url: project.url,
    contractor: projectContractor(project),
    contractor_code: project.contractor_code,
    location: projectLocation(project),
    office: project.office,
    category: project.category,
  }
}
