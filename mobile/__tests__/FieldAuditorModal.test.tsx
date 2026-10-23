import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

// Simulate real hardware GPS: a fix near Bogo City (the mock project's LGU
// centroid fallback). Individual tests override this with mockResolvedValueOnce.
jest.mock('../src/services/location', () => ({
  getDeviceFix: jest.fn().mockResolvedValue({
    latitude: 11.0169,
    longitude: 123.9873,
    accuracy: 5,
  }),
  requestCameraPermission: jest.fn().mockResolvedValue(true),
  requestLocationPermission: jest.fn().mockResolvedValue(true),
}));

import FieldAuditorModal from '../src/ui/components/FieldAuditorModal';
import { ProjectDetail } from '../src/core/types';
import { outbox } from '../src/services/outbox';
import { api } from '../src/services/api';
import { getDeviceFix } from '../src/services/location';

const mockGetDeviceFix = getDeviceFix as jest.Mock;

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

    expect(queryByTestId('field-auditor-modal')).toBeNull();
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
    const { getByTestId, getByText, getAllByText } = render(
      <FieldAuditorModal
        visible={true}
        project={mockProject}
        onClose={mockOnClose}
        onAuditSubmitted={mockOnAuditSubmitted}
      />,
    );

    expect(getByTestId('field-auditor-modal')).toBeTruthy();
    expect(getAllByText('24HD0012').length).toBeGreaterThan(0);
    expect(getByText(/Construction of Flood Mitigation Structure/)).toBeTruthy();
    expect(getByTestId('geofence-radar-badge')).toBeTruthy();
    expect(getByTestId('auditor-shutter-btn')).toBeTruthy();
  });

  test('captures off-site without geofence lock and flags the report as a photo flag', async () => {
    // Cebu City fix — ~78km away from Bogo City project centroid
    mockGetDeviceFix.mockResolvedValueOnce({
      latitude: 10.3157,
      longitude: 123.8854,
      accuracy: 8,
    });

    const { getByText, getByTestId, findByTestId } = render(
      <FieldAuditorModal
        visible={true}
        project={mockProject}
        onClose={mockOnClose}
        onAuditSubmitted={mockOnAuditSubmitted}
      />,
    );

    // Banner shows off-site status but the shutter is never locked
    await waitFor(() => expect(getByText(/Off-site/)).toBeTruthy());
    const shutterBtn = getByTestId('auditor-shutter-btn');
    expect(getByText('Capture Site Photo')).toBeTruthy();

    // Capture + submit work off-site; receipt is flagged, not on-site verified
    fireEvent.press(shutterBtn);
    await waitFor(() => expect(outbox.getAllAudits().length).toBe(1));
    expect(getByTestId('receipt-code-badge')).toBeTruthy();
    expect(getByText('🚩 PHOTO FLAG — OFF-SITE')).toBeTruthy();
    expect(outbox.getAllAudits()[0].verification).toBe('photo_flag');
    await findByTestId('report-verdict');
  });

  test('shows GPS acquiring state and retry re-runs acquisition until a fix arrives', async () => {
    // First acquisition (on modal open) fails; the base mock then supplies a fix
    mockGetDeviceFix.mockResolvedValueOnce(null);

    const { getByText, getByTestId } = render(
      <FieldAuditorModal
        visible={true}
        project={mockProject}
        onClose={mockOnClose}
        onAuditSubmitted={mockOnAuditSubmitted}
      />,
    );

    await waitFor(() => expect(getByText('Acquiring GPS lock…')).toBeTruthy());
    expect(getByTestId('retry-gps-btn')).toBeTruthy();
    // Capture stays available even without a GPS fix
    expect(getByText('Capture Site Photo')).toBeTruthy();

    // Retry re-runs the full GPS acquisition pipeline and the fix arrives
    fireEvent.press(getByTestId('retry-gps-btn'));
    await waitFor(() => expect(mockGetDeviceFix).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(getByText(/On-site/)).toBeTruthy());
  });

  test('captures on-site audit, enqueues to outbox, and displays receipt badge', async () => {
    const { getByTestId, getByText, findByTestId } = render(
      <FieldAuditorModal
        visible={true}
        project={mockProject}
        onClose={mockOnClose}
        onAuditSubmitted={mockOnAuditSubmitted}
      />,
    );

    const shutterBtn = getByTestId('auditor-shutter-btn');
    // Banner flips to on-site once the async hardware GPS fix arrives
    await waitFor(() => expect(getByText(/On-site \(/)).toBeTruthy());
    fireEvent.press(shutterBtn);

    // Verify outbox received the item once the async capture settles
    // (the instantly-resolved API mock may already have marked it synced,
    // so assert on the full queue rather than pending-only count).
    await waitFor(() => expect(outbox.getAllAudits().length).toBe(1));
    expect(outbox.getAllAudits()[0].verification).toBe('onsite');
    expect(mockOnAuditSubmitted).toHaveBeenCalledTimes(1);

    // Verify receipt badge rendered with on-site verification
    expect(getByTestId('receipt-code-badge')).toBeTruthy();
    expect(getByText(/On-Site Audit Queued!/)).toBeTruthy();
    expect(getByText('📍 ONSITE VERIFIED')).toBeTruthy();

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
