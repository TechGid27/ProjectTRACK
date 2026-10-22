import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

// Simulate real hardware GPS: a fix near Bogo City (the mock project's LGU
// centroid fallback) so the automatic geofence opens the shutter on-site.
jest.mock('../src/services/location', () => ({
  getDeviceFix: jest.fn().mockResolvedValue({
    latitude: 11.0169,
    longitude: 123.9873,
    accuracy: 5,
  }),
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
    const { getByText, getAllByText, getByPlaceholderText, getByTestId } = render(
      <ReportAnomalyModal
        visible={true}
        project={mockProject}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        onAuditSubmitted={mockOnAuditSubmitted}
      />,
    );

    expect(getByText('Field Audit & Anomaly Report')).toBeTruthy();
    expect(getAllByText('24HD0012').length).toBeGreaterThan(0);
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
      getByText('A live site photo is required to submit a field audit.'),
    ).toBeTruthy();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  test('shows validation error when attempting to submit with too short description', async () => {
    const { getByText, getByPlaceholderText, getByTestId } = render(
      <ReportAnomalyModal
        visible={true}
        project={mockProject}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    // Wait for the async GPS fix to classify the capture as on-site
    await waitFor(() => expect(getByText(/On-site \(/)).toBeTruthy());
    const shutterBtn = getByTestId('auditor-shutter-btn');
    fireEvent.press(shutterBtn);
    await waitFor(() => expect(getByTestId('receipt-code-badge')).toBeTruthy());

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

    // Wait for async GPS fix, then capture mandatory photo
    await waitFor(() => expect(getByText(/On-site \(/)).toBeTruthy());
    const shutterBtn = getByTestId('auditor-shutter-btn');
    fireEvent.press(shutterBtn);
    await waitFor(() => expect(mockOnAuditSubmitted).toHaveBeenCalled());

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

  test('renders a live camera viewfinder and the captured photo preview after shutter', async () => {
    const { getByTestId, getByText } = render(
      <ReportAnomalyModal
        visible={true}
        project={mockProject}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        onAuditSubmitted={mockOnAuditSubmitted}
      />,
    );

    // Live camera feed is visible once permission is granted
    await waitFor(() => expect(getByTestId('site-camera-preview')).toBeTruthy());
    // GPS fix settles so the capture is classified on-site
    await waitFor(() => expect(getByText(/On-site \(/)).toBeTruthy());

    // Capturing swaps the feed for the captured photo preview
    fireEvent.press(getByTestId('auditor-shutter-btn'));
    await waitFor(() => expect(getByTestId('captured-photo-preview')).toBeTruthy());
    expect(mockOnAuditSubmitted).toHaveBeenCalledTimes(1);
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

  test('sorts project chips nearest-to-GPS first and tags NEARBY vs OFF-SITE', async () => {
    // GPS fix is near Bogo City; Oslob is ~100km south
    const { getByTestId, getAllByTestId, getByText } = render(
      <ReportAnomalyModal
        visible={true}
        project={null}
        availableProjects={[
          {
            id: '24HD0099',
            title: 'Oslob Seawall Rehabilitation',
            contractor: 'WTG CONSTRUCTION',
            budget: 35000000,
            status: 'Ongoing',
            lgu: 'Oslob',
          },
          mockProject,
        ]}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />,
    );

    // Bogo chip (near GPS) is sorted before the far Oslob chip
    await waitFor(() => {
      const chips = getAllByTestId(/^project-chip-\d/);
      expect(chips[0].props.testID).toBe('project-chip-24HD0012');
      expect(chips[1].props.testID).toBe('project-chip-24HD0099');
    });

    // Live distances and proximity tags
    const nearDistance = getByTestId('project-chip-distance-24HD0012');
    expect(String(nearDistance.props.children)).toMatch(/\d+ m$/);
    expect(getByText('NEARBY')).toBeTruthy();

    const farDistance = getByTestId('project-chip-distance-24HD0099');
    expect(String(farDistance.props.children)).toMatch(/km$/);
    expect(getByText('OFF-SITE')).toBeTruthy();

    // Header reflects proximity ordering once GPS is live
    expect(getByText(/NEAREST TO YOUR LOCATION/)).toBeTruthy();
  });
});
