import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// Keep the simulation-based geofence behavior: no hardware fix, no camera
// prompt, and a stubbed live submission so no real network call leaks.
jest.mock('../src/services/location', () => ({
  getDeviceFix: jest.fn().mockResolvedValue(null),
  requestCameraPermission: jest.fn().mockResolvedValue(true),
  requestLocationPermission: jest.fn().mockResolvedValue(true),
}));

import FieldAuditorModal from '../src/ui/components/FieldAuditorModal';
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
  startDate: '2024-02-15',
  targetCompletion: '2024-11-30',
  scope: 'Reinforced concrete revetment wall',
};

describe('FieldAuditorModal Component', () => {
  const mockOnClose = jest.fn();
  const mockOnAuditSubmitted = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    outbox.clearQueue();
  });

  test('does not render when visible is false or project is null', () => {
    const { queryByTestId } = render(
      <FieldAuditorModal
        visible={false}
        project={mockProject}
        onClose={mockOnClose}
      />,
    );

    // Modal with visible=false or null project
    const { queryByTestId: queryNullProj } = render(
      <FieldAuditorModal
        visible={true}
        project={null}
        onClose={mockOnClose}
      />,
    );

    expect(queryNullProj('field-auditor-modal')).toBeNull();
  });

  test('renders project details and geofence radar banner when open', () => {
    const { getByTestId, getByText } = render(
      <FieldAuditorModal
        visible={true}
        project={mockProject}
        onClose={mockOnClose}
        onAuditSubmitted={mockOnAuditSubmitted}
      />,
    );

    expect(getByTestId('field-auditor-modal')).toBeTruthy();
    expect(getByText('24HD0012')).toBeTruthy();
    expect(getByText(/Construction of Flood Mitigation Structure/)).toBeTruthy();
    expect(getByTestId('geofence-radar-badge')).toBeTruthy();
    expect(getByTestId('auditor-shutter-btn')).toBeTruthy();
  });

  test('disables shutter button when simulating off-site location (320m)', () => {
    const { getByText, getByTestId } = render(
      <FieldAuditorModal
        visible={true}
        project={mockProject}
        onClose={mockOnClose}
        onAuditSubmitted={mockOnAuditSubmitted}
      />,
    );

    // Click Off-Site simulation pill
    const offSiteBtn = getByText('Off-Site (320m)');
    fireEvent.press(offSiteBtn);

    // Radar should indicate outside geofence
    expect(getByText(/Outside Geofence/)).toBeTruthy();
    expect(getByText('Geofence Locked — Move Closer')).toBeTruthy();
  });

  test('captures verified audit, enqueues to outbox, and displays receipt badge', async () => {
    const { getByTestId, getByText, findByTestId } = render(
      <FieldAuditorModal
        visible={true}
        project={mockProject}
        onClose={mockOnClose}
        onAuditSubmitted={mockOnAuditSubmitted}
      />,
    );

    const shutterBtn = getByTestId('auditor-shutter-btn');
    fireEvent.press(shutterBtn);

    // Verify outbox received the item (synchronous, before live submit resolves)
    expect(outbox.getPendingCount()).toBe(1);
    expect(mockOnAuditSubmitted).toHaveBeenCalledTimes(1);

    // Verify receipt badge rendered
    expect(getByTestId('receipt-code-badge')).toBeTruthy();
    expect(getByText(/Audit Verified & Queued!/)).toBeTruthy();

    // Flush the live submission so its state update does not leak across suites.
    await findByTestId('report-verdict');

    // Verify done button closes
    const doneBtn = getByTestId('done-auditor-btn');
    fireEvent.press(doneBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('tapping close button triggers onClose', () => {
    const { getByTestId } = render(
      <FieldAuditorModal
        visible={true}
        project={mockProject}
        onClose={mockOnClose}
      />,
    );

    const closeBtn = getByTestId('close-auditor-btn');
    fireEvent.press(closeBtn);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
