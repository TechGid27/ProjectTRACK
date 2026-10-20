import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

// --- Mock hardware + network before importing the component ----------------
jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getCurrentPositionAsync: jest
    .fn()
    .mockResolvedValue({ coords: { latitude: 11.0509, longitude: 124.0055, accuracy: 5 } }),
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

    // Hardware fix (mocked ~44m) keeps the shutter unlocked.
    fireEvent.press(getByTestId('auditor-shutter-btn'));

    // Receipt is enqueued immediately (offline-first).
    expect(outbox.getAllAudits().length).toBe(1);

    // Live submission resolves and the verdict badges render.
    await waitFor(() => expect(getByTestId('report-verdict')).toBeTruthy());
    expect(submitSpy).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: '24HD0012' }),
    );
    expect(getByText('Verified')).toBeTruthy();
  });

  test('failed live submission keeps the audit queued for later sync', async () => {
    jest.spyOn(api, 'submitReport').mockRejectedValue(new Error('offline'));

    const { getByTestId } = render(
      <FieldAuditorModal visible project={mockProject} onClose={jest.fn()} />,
    );

    fireEvent.press(getByTestId('auditor-shutter-btn'));
    // Receipt still shown; item stays pending because the POST failed.
    await waitFor(() => expect(getByTestId('receipt-code-badge')).toBeTruthy());
    expect(outbox.getPendingCount()).toBe(1);
  });
});
