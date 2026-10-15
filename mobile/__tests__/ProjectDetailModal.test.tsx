import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ProjectDetailModal from '../src/ui/components/ProjectDetailModal';
import { ProjectDetail } from '../src/core/types';

const mockProject: ProjectDetail = {
  id: '24HD0012',
  title: 'Construction of Flood Mitigation Structure along Bogo River',
  contractor: 'QM BUILDERS',
  budget: 49000000,
  status: 'Ongoing',
  lgu: 'Bogo City',
  barangay: 'Cogon',
  startDate: '2024-02-15',
  targetCompletion: '2024-11-30',
  scope: 'Reinforced concrete revetment wall, sheet piling, and drainage canal outfall.',
};

describe('ProjectDetailModal Component', () => {
  const mockOnClose = jest.fn();
  const mockOnReportAnomaly = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders all project details properly when visible', () => {
    const { getByText } = render(
      <ProjectDetailModal
        visible={true}
        project={mockProject}
        onClose={mockOnClose}
        onReportAnomaly={mockOnReportAnomaly}
      />,
    );

    expect(getByText('24HD0012')).toBeTruthy();
    expect(getByText('Construction of Flood Mitigation Structure along Bogo River')).toBeTruthy();
    expect(getByText('QM BUILDERS')).toBeTruthy();
    expect(getByText('₱49.00M')).toBeTruthy();
    expect(getByText('Ongoing')).toBeTruthy();
    expect(getByText('Bogo City, Cogon')).toBeTruthy();
    expect(getByText('2024-02-15')).toBeTruthy();
    expect(getByText('2024-11-30')).toBeTruthy();
    expect(
      getByText('Reinforced concrete revetment wall, sheet piling, and drainage canal outfall.'),
    ).toBeTruthy();
  });

  test('pressing Close button calls onClose', () => {
    const { getByLabelText } = render(
      <ProjectDetailModal
        visible={true}
        project={mockProject}
        onClose={mockOnClose}
        onReportAnomaly={mockOnReportAnomaly}
      />,
    );

    const closeBtn = getByLabelText('Close details');
    fireEvent.press(closeBtn);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('pressing Report Anomaly button calls onReportAnomaly with project', () => {
    const { getByText } = render(
      <ProjectDetailModal
        visible={true}
        project={mockProject}
        onClose={mockOnClose}
        onReportAnomaly={mockOnReportAnomaly}
      />,
    );

    const reportBtn = getByText('Report Anomaly on this Project');
    fireEvent.press(reportBtn);

    expect(mockOnReportAnomaly).toHaveBeenCalledWith(mockProject);
  });

  test('renders nothing when project is null', () => {
    const { queryByText } = render(
      <ProjectDetailModal
        visible={true}
        project={null}
        onClose={mockOnClose}
        onReportAnomaly={mockOnReportAnomaly}
      />,
    );

    expect(queryByText('QM BUILDERS')).toBeNull();
  });
});
