import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import LocationIntelSheet from '../src/ui/components/LocationIntelSheet';
import { ProjectDetail } from '../src/core/types';

const sampleProjects: ProjectDetail[] = [
  {
    id: '24HD0012',
    title: 'Flood Mitigation Structure along Bogo River',
    contractor: 'QM BUILDERS',
    budget: 49000000,
    status: 'Ongoing',
    lgu: 'Bogo City',
    barangay: 'Cogon',
    startDate: '2024-02-15',
    targetCompletion: '2024-11-30',
    scope: 'Reinforced concrete revetment wall',
  },
  {
    id: '24HD0045',
    title: 'Rehabilitation of Asphalt Pavement',
    contractor: 'FIRST GRANDEUR BUILDERS',
    budget: 28420000,
    status: 'Completed',
    lgu: 'Bogo City',
    barangay: 'Lourdes',
    startDate: '2023-09-01',
    targetCompletion: '2024-03-15',
    scope: 'Asphalt overlay',
  },
  {
    id: '24HD0033',
    title: 'Farm-to-Market Road Concreting',
    contractor: 'WTG CONSTRUCTION',
    budget: 62150000,
    status: 'Delayed',
    lgu: 'Bogo City',
    barangay: 'Don Pedro',
    startDate: '2023-11-01',
    targetCompletion: '2024-06-30',
    scope: 'Concreting of 4.2km gravel road',
  },
];

describe('LocationIntelSheet Component', () => {
  const mockOnSelectProject = jest.fn();
  const mockOnReportAnomaly = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders municipality name, stats summary, and project cards', () => {
    const { getByText } = render(
      <LocationIntelSheet
        lguName="Bogo City"
        projects={sampleProjects}
        onSelectProject={mockOnSelectProject}
        onReportAnomaly={mockOnReportAnomaly}
        onClose={mockOnClose}
      />,
    );

    // Municipality name
    expect(getByText('Bogo City')).toBeTruthy();

    // Summary statistics
    expect(getByText('3 Projects')).toBeTruthy();
    expect(getByText('₱139.57M')).toBeTruthy(); // 49M + 28.42M + 62.15M = 139.57M

    // Project cards
    expect(getByText('Flood Mitigation Structure along Bogo River')).toBeTruthy();
    expect(getByText('Rehabilitation of Asphalt Pavement')).toBeTruthy();
    expect(getByText('Farm-to-Market Road Concreting')).toBeTruthy();
  });

  test('tapping a project card triggers onSelectProject with the project data', () => {
    const { getByText } = render(
      <LocationIntelSheet
        lguName="Bogo City"
        projects={sampleProjects}
        onSelectProject={mockOnSelectProject}
        onReportAnomaly={mockOnReportAnomaly}
        onClose={mockOnClose}
      />,
    );

    const projectCard = getByText('Flood Mitigation Structure along Bogo River');
    fireEvent.press(projectCard);

    expect(mockOnSelectProject).toHaveBeenCalledWith(sampleProjects[0]);
  });

  test('tapping Report Anomaly button triggers onReportAnomaly callback', () => {
    const { getByText } = render(
      <LocationIntelSheet
        lguName="Bogo City"
        projects={sampleProjects}
        onSelectProject={mockOnSelectProject}
        onReportAnomaly={mockOnReportAnomaly}
        onClose={mockOnClose}
      />,
    );

    const reportBtn = getByText(/Report Anomaly/i);
    fireEvent.press(reportBtn);

    expect(mockOnReportAnomaly).toHaveBeenCalledWith('Bogo City');
  });

  test('filters projects by status chip', () => {
    const { getByText, queryByText } = render(
      <LocationIntelSheet
        lguName="Bogo City"
        projects={sampleProjects}
        onSelectProject={mockOnSelectProject}
        onReportAnomaly={mockOnReportAnomaly}
        onClose={mockOnClose}
      />,
    );

    // Tap 'Ongoing' chip filter
    const ongoingFilterChip = getByText('Ongoing (1)');
    fireEvent.press(ongoingFilterChip);

    expect(getByText('Flood Mitigation Structure along Bogo River')).toBeTruthy();
    expect(queryByText('Rehabilitation of Asphalt Pavement')).toBeNull();
    expect(queryByText('Farm-to-Market Road Concreting')).toBeNull();
  });

  test('displays empty state when no projects match location or filter', () => {
    const { getByText } = render(
      <LocationIntelSheet
        lguName="Alcoy"
        projects={[]}
        onSelectProject={mockOnSelectProject}
        onReportAnomaly={mockOnReportAnomaly}
        onClose={mockOnClose}
      />,
    );

    expect(getByText('No civil works projects recorded for this area.')).toBeTruthy();
  });
});
