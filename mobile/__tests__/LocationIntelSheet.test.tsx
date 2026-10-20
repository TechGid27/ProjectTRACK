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
  const mockOnFieldAuditPress = jest.fn();
  const mockOnClose = jest.fn();
  const mockOnStateChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders municipality name, stats summary, and project cards in expanded mode', () => {
    const { getByText, getByTestId } = render(
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
    expect(getByText('₱139.57M')).toBeTruthy();

    // Project cards
    expect(getByText('Flood Mitigation Structure along Bogo River')).toBeTruthy();
    expect(getByText('Rehabilitation of Asphalt Pavement')).toBeTruthy();
    expect(getByText('Farm-to-Market Road Concreting')).toBeTruthy();

    // Controls
    expect(getByTestId('sheet-minimize-btn')).toBeTruthy();
    expect(getByTestId('sheet-close-btn')).toBeTruthy();
  });

  test('tapping minimize button triggers onStateChange with "minimized"', () => {
    const { getByTestId } = render(
      <LocationIntelSheet
        lguName="Bogo City"
        projects={sampleProjects}
        sheetState="expanded"
        onStateChange={mockOnStateChange}
        onSelectProject={mockOnSelectProject}
        onReportAnomaly={mockOnReportAnomaly}
        onClose={mockOnClose}
      />,
    );

    const minimizeBtn = getByTestId('sheet-minimize-btn');
    fireEvent.press(minimizeBtn);

    expect(mockOnStateChange).toHaveBeenCalledWith('minimized');
  });

  test('renders compact peek bar in "minimized" state and hides project cards list', () => {
    const { getByTestId, queryByText, getByText } = render(
      <LocationIntelSheet
        lguName="Bogo City"
        projects={sampleProjects}
        sheetState="minimized"
        onStateChange={mockOnStateChange}
        onSelectProject={mockOnSelectProject}
        onReportAnomaly={mockOnReportAnomaly}
        onClose={mockOnClose}
      />,
    );

    // Minimized bar exists
    expect(getByTestId('location-intel-sheet-minimized')).toBeTruthy();
    expect(getByText(/Bogo City/i)).toBeTruthy();

    // Detailed project cards should not be displayed
    expect(queryByText('Flood Mitigation Structure along Bogo River')).toBeNull();

    // Expand and hide buttons exist in minimized bar
    const expandBtn = getByTestId('sheet-expand-btn');
    const hideBtn = getByTestId('sheet-hide-btn');
    expect(expandBtn).toBeTruthy();
    expect(hideBtn).toBeTruthy();

    // Press expand
    fireEvent.press(expandBtn);
    expect(mockOnStateChange).toHaveBeenCalledWith('expanded');

    // Press hide
    fireEvent.press(hideBtn);
    expect(mockOnStateChange).toHaveBeenCalledWith('hidden');
  });

  test('returns null when sheetState is "hidden"', () => {
    const { queryByTestId } = render(
      <LocationIntelSheet
        lguName="Bogo City"
        projects={sampleProjects}
        sheetState="hidden"
        onStateChange={mockOnStateChange}
        onSelectProject={mockOnSelectProject}
        onReportAnomaly={mockOnReportAnomaly}
        onClose={mockOnClose}
      />,
    );

    expect(queryByTestId('location-intel-sheet')).toBeNull();
    expect(queryByTestId('location-intel-sheet-minimized')).toBeNull();
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

    const reportBtn = getByText('⚠️ Report Anomaly');
    fireEvent.press(reportBtn);

    expect(mockOnReportAnomaly).toHaveBeenCalledWith('Bogo City');
  });

  test('tapping field audit button triggers onFieldAuditPress callback', () => {
    const { getByTestId } = render(
      <LocationIntelSheet
        lguName="Bogo City"
        projects={sampleProjects}
        onSelectProject={mockOnSelectProject}
        onReportAnomaly={mockOnReportAnomaly}
        onFieldAuditPress={mockOnFieldAuditPress}
        onClose={mockOnClose}
      />,
    );

    const auditBtn = getByTestId('field-audit-btn-24HD0012');
    fireEvent.press(auditBtn);

    expect(mockOnFieldAuditPress).toHaveBeenCalledWith(sampleProjects[0]);
  });

  test('tapping confirm and dispute crowdsource buttons updates counters', () => {
    const { getByTestId, getByText } = render(
      <LocationIntelSheet
        lguName="Bogo City"
        projects={sampleProjects}
        onSelectProject={mockOnSelectProject}
        onReportAnomaly={mockOnReportAnomaly}
        onClose={mockOnClose}
      />,
    );

    const confirmBtn = getByTestId('confirm-vote-btn-24HD0012');
    const disputeBtn = getByTestId('dispute-vote-btn-24HD0012');

    // Default confirm vote is 14
    expect(getByText('👍 14')).toBeTruthy();

    fireEvent.press(confirmBtn);
    expect(getByText('👍 15')).toBeTruthy();

    // Default dispute vote is 1
    expect(getByText('👎 1')).toBeTruthy();

    fireEvent.press(disputeBtn);
    expect(getByText('👎 2')).toBeTruthy();
  });
});
