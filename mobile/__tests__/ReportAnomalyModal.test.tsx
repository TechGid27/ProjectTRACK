import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ReportAnomalyModal from '../src/ui/components/ReportAnomalyModal';
import { ProjectDetail } from '../src/core/types';

const mockProject: ProjectDetail = {
  id: '24HD0012',
  title: 'Construction of Flood Mitigation Structure along Bogo River',
  contractor: 'QM BUILDERS',
  budget: 49000000,
  status: 'Ongoing',
  lgu: 'Bogo City',
  barangay: 'Cogon',
};

describe('ReportAnomalyModal Component', () => {
  const mockOnClose = jest.fn();
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders form fields with default project selection', () => {
    const { getByText, getByPlaceholderText } = render(
      <ReportAnomalyModal
        visible={true}
        project={mockProject}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    expect(getByText('Report Project Anomaly')).toBeTruthy();
    expect(getByText('24HD0012')).toBeTruthy();
    expect(getByText('Ghost Project / Abandoned')).toBeTruthy();
    expect(getByPlaceholderText(/Describe observed issues, missing equipment/i)).toBeTruthy();
  });

  test('shows validation error when attempting to submit with too short description', () => {
    const { getByText, getByPlaceholderText } = render(
      <ReportAnomalyModal
        visible={true}
        project={mockProject}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    const descInput = getByPlaceholderText(/Describe observed issues, missing equipment/i);
    fireEvent.changeText(descInput, 'Too short');

    const submitBtn = getByText('Submit Report');
    fireEvent.press(submitBtn);

    expect(
      getByText('Please provide a detailed description (at least 15 characters).'),
    ).toBeTruthy();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  test('submits valid anomaly report successfully', () => {
    const { getByText, getByPlaceholderText } = render(
      <ReportAnomalyModal
        visible={true}
        project={mockProject}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    // Select category "Substandard Materials"
    const catBtn = getByText('Substandard Materials');
    fireEvent.press(catBtn);

    const descInput = getByPlaceholderText(/Describe observed issues, missing equipment/i);
    fireEvent.changeText(
      descInput,
      'Severe cracks in reinforced concrete revetment wall noticed after light rain.',
    );

    const submitBtn = getByText('Submit Report');
    fireEvent.press(submitBtn);

    expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    const submittedData = mockOnSubmit.mock.calls[0][0];
    expect(submittedData.projectId).toBe('24HD0012');
    expect(submittedData.category).toBe('substandard_materials');
    expect(submittedData.description).toBe(
      'Severe cracks in reinforced concrete revetment wall noticed after light rain.',
    );
    expect(typeof submittedData.timestamp).toBe('number');
  });

  test('cancel button calls onClose', () => {
    const { getByText } = render(
      <ReportAnomalyModal
        visible={true}
        project={mockProject}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    const cancelBtn = getByText('Cancel');
    fireEvent.press(cancelBtn);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
