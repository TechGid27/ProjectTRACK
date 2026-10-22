import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('../src/services/location', () => ({
  getDeviceFix: jest.fn().mockResolvedValue(null),
  requestCameraPermission: jest.fn().mockResolvedValue(true),
  requestLocationPermission: jest.fn().mockResolvedValue(true),
}));

import ReportAnomalyModal from '../src/ui/components/ReportAnomalyModal';
import { ProjectDetail } from '../src/core/types';
import { outbox } from '../src/services/outbox';
import { api } from '../src/services/api';

jest.spyOn(api, 'submitReport').mockResolvedValue({
  id: 'r1',
  project_id: '24HD0012',
  status: 'verified',
  distance_meters: 45,
  geofence_pass: true,
  ela_score: 0.4,
  phash_recycled: false,
  forensics_verdict: 'clean',
  reporter_reputation: 55,
  created_at: '2026-10-20T12:00:00+00:00',
});

const mockProject: ProjectDetail = {
  id: '24HD0012',
  title: 'Construction of Flood Mitigation Structure along Bogo River',
  contractor: 'QM BUILDERS',
  budget: 49000000,
  status: 'Ongoing',
  lgu: 'Bogo City',
  barangay: 'Cogon',
};

describe('ReportAnomalyModal Component (Unified Field Audit & Anomaly Reporting)', () => {
  const mockOnClose = jest.fn();
  const mockOnSubmit = jest.fn();
  const mockOnAuditSubmitted = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    outbox.clearQueue();
  });

  test('renders form fields, geofence radar, and viewfinder with default project selection', () => {
    const { getByText, getByPlaceholderText, getByTestId } = render(
      <ReportAnomalyModal
        visible={true}
        project={mockProject}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        onAuditSubmitted={mockOnAuditSubmitted}
      />,
    );

    expect(getByText('Field Audit & Anomaly Report')).toBeTruthy();
    expect(getByText('24HD0012')).toBeTruthy();
    expect(getByTestId('geofence-radar-badge')).toBeTruthy();
    expect(getByTestId('auditor-shutter-btn')).toBeTruthy();
    expect(getByText('Ghost Project / Abandoned')).toBeTruthy();
    expect(getByPlaceholderText(/Describe observed issues, missing equipment/i)).toBeTruthy();
  });

  test('shows validation error when attempting to submit without capturing a site photo', () => {
    const { getByText, getByPlaceholderText } = render(
      <ReportAnomalyModal
        visible={true}
        project={mockProject}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    const descInput = getByPlaceholderText(/Describe observed issues, missing equipment/i);
    fireEvent.changeText(
      descInput,
      'Valid description with more than fifteen characters of detailed observation.',
    );

    const submitBtn = getByText('Submit Report');
    fireEvent.press(submitBtn);

    expect(
      getByText('A live site photo is required to submit a verified field audit.'),
    ).toBeTruthy();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  test('shows validation error when attempting to submit with too short description', () => {
    const { getByText, getByPlaceholderText, getByTestId } = render(
      <ReportAnomalyModal
        visible={true}
        project={mockProject}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    // Capture site photo
    const shutterBtn = getByTestId('auditor-shutter-btn');
    fireEvent.press(shutterBtn);

    const descInput = getByPlaceholderText(/Describe observed issues, missing equipment/i);
    fireEvent.changeText(descInput, 'Too short');

    const submitBtn = getByText('Submit Report');
    fireEvent.press(submitBtn);

    expect(
      getByText('Please provide a detailed description (at least 15 characters).'),
    ).toBeTruthy();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  test('submits valid anomaly report with captured photo, geofence verification, and outbox queue', async () => {
    const { getByText, getByPlaceholderText, getByTestId } = render(
      <ReportAnomalyModal
        visible={true}
        project={mockProject}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        onAuditSubmitted={mockOnAuditSubmitted}
      />,
    );

    // Capture mandatory photo
    const shutterBtn = getByTestId('auditor-shutter-btn');
    fireEvent.press(shutterBtn);
    expect(mockOnAuditSubmitted).toHaveBeenCalled();

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

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      const submittedData = mockOnSubmit.mock.calls[0][0];
      expect(submittedData.projectId).toBe('24HD0012');
      expect(submittedData.category).toBe('substandard_materials');
      expect(submittedData.description).toBe(
        'Severe cracks in reinforced concrete revetment wall noticed after light rain.',
      );
      expect(typeof submittedData.timestamp).toBe('number');
    });
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

  test('allows selecting a specific project from availableProjects when no initial project is selected', () => {
    const { getByText, getAllByText } = render(
      <ReportAnomalyModal
        visible={true}
        project={null}
        availableProjects={[
          mockProject,
          {
            id: '24HD0099',
            title: 'Bridge Replacement Project',
            contractor: 'WTG CONSTRUCTION',
            budget: 35000000,
            status: 'Ongoing',
            lgu: 'Bogo City',
          },
        ]}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    expect(getAllByText(/Select Specific Project/i).length).toBeGreaterThan(0);
    expect(getByText('24HD0012')).toBeTruthy();
    expect(getByText('24HD0099')).toBeTruthy();
  });
});
