import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

// --- Mock hardware + network before importing the component ----------------
// GPS fix sits ~40m from Bogo City's GeoJSON centroid (the mock project's LGU)
jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getCurrentPositionAsync: jest
    .fn()
    .mockResolvedValue({ coords: { latitude: 11.0169, longitude: 123.9873, accuracy: 5 } }),
}));
jest.mock('expo-camera', () => ({
  Camera: {
    requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  },
}));

import FieldAuditorModal from '../src/ui/components/FieldAuditorModal';
import { ProjectDetail } from '../src/core/types';
import { outbox } from '../src/services/outbox';
import { api } from '../src/services/api';

// Hardware-flavored suite can be slow under parallel jest workers.
jest.setTimeout(15000);

const mockProject: ProjectDetail = {
  id: '24HD0012',
  title: 'Construction of Flood Mitigation Structure along Bogo River',
  contractor: 'QM BUILDERS',
  budget: 49000000,
  status: 'Ongoing',
  lgu: 'Bogo City',
};

describe('FieldAuditorModal hardware capture + verdict (Pillars 1 & 5)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    outbox.clearQueue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('on-site capture submits live and renders the server verdict badges', async () => {
    const submitSpy = jest.spyOn(api, 'submitReport').mockResolvedValue({
      id: 'r1',
      project_id: '24HD0012',
      status: 'verified',
      distance_meters: 44,
      geofence_pass: true,
      ela_score: 0.4,
      phash_recycled: false,
      forensics_verdict: 'clean',
      reporter_reputation: 59,
      created_at: '2026-10-20T12:00:00+00:00',
    });

    const { getByTestId, getByText } = render(
      <FieldAuditorModal visible project={mockProject} onClose={jest.fn()} />,
    );

    // Wait for the async hardware GPS fix (~40m) to unlock the shutter.
    await waitFor(() => expect(getByText(/Inside Geofence/)).toBeTruthy());
    fireEvent.press(getByTestId('auditor-shutter-btn'));

    // Receipt is enqueued once the capture settles (offline-first).
    await waitFor(() => expect(outbox.getAllAudits().length).toBe(1));

    // Live submission resolves and the verdict badges render.
    await waitFor(() => expect(getByTestId('report-verdict')).toBeTruthy());
    expect(submitSpy).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: '24HD0012' }),
    );
    expect(getByText('Verified')).toBeTruthy();
  });

  test('failed live submission keeps the audit queued for later sync', async () => {
    jest.spyOn(api, 'submitReport').mockRejectedValue(new Error('offline'));

    const { getByTestId, getByText } = render(
      <FieldAuditorModal visible project={mockProject} onClose={jest.fn()} />,
    );

    // Wait for the hardware GPS fix before capturing
    await waitFor(() => expect(getByText(/Inside Geofence/)).toBeTruthy());
    fireEvent.press(getByTestId('auditor-shutter-btn'));
    // Receipt still shown; item stays pending because the POST failed.
    await waitFor(() => expect(getByTestId('receipt-code-badge')).toBeTruthy());
    expect(outbox.getPendingCount()).toBe(1);
  });
});
