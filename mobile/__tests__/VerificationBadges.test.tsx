import React from 'react';
import { render } from '@testing-library/react-native';
import VerificationBadges, { formatDistance } from '../src/ui/components/VerificationBadges';
import { ReportVerification } from '../src/core/types';

const base: ReportVerification = {
  id: 'r1',
  project_id: '24HD0012',
  status: 'verified',
  distance_meters: 45,
  geofence_pass: true,
  ela_score: 0.5,
  phash_recycled: false,
  forensics_verdict: 'clean',
  reporter_reputation: 59,
  created_at: '2026-10-20T12:00:00+00:00',
};

describe('VerificationBadges (Pillar 5, mobile)', () => {
  test('renders verified status, distance, forensics, reputation', () => {
    const { getByText } = render(<VerificationBadges report={base} />);
    expect(getByText('Verified')).toBeTruthy();
    expect(getByText('45m from site')).toBeTruthy();
    expect(getByText('Forensics: Clean')).toBeTruthy();
    expect(getByText('Reporter: 59')).toBeTruthy();
  });

  test('renders flagged + recycled semantics matching the website', () => {
    const { getByText } = render(
      <VerificationBadges
        report={{ ...base, status: 'flagged', forensics_verdict: 'recycled', geofence_pass: false, distance_meters: 3000 }}
      />,
    );
    expect(getByText('Flagged')).toBeTruthy();
    expect(getByText('Forensics: Recycled Photo')).toBeTruthy();
    expect(getByText('3.0km from site')).toBeTruthy();
  });

  test('returns null without a report', () => {
    const { toJSON } = render(<VerificationBadges report={null} />);
    expect(toJSON()).toBeNull();
  });

  test('formatDistance handles null and km', () => {
    expect(formatDistance(null)).toBe('Location not provided');
    expect(formatDistance(2500)).toBe('2.5km from site');
  });
});
