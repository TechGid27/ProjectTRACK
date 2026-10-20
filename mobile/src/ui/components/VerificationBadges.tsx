/**
 * Verification Badges (Pillar 5 — Epistemic UI Badging, mobile)
 * =============================================================
 * Renders the shared verification verdict the backend returns, matching the
 * website's badge semantics so a report reads identically on both clients.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ReportVerification } from '../../core/types';

export const STATUS_LABELS: Record<string, string> = {
  verified: 'Verified',
  pending: 'Pending Review',
  flagged: 'Flagged',
  rejected: 'Rejected',
};

export const FORENSICS_LABELS: Record<string, string> = {
  clean: 'Forensics: Clean',
  suspicious: 'Forensics: Suspicious',
  recycled: 'Forensics: Recycled Photo',
};

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  verified: { bg: '#ecfdf5', fg: '#065f46' },
  pending: { bg: '#fef3c7', fg: '#92400e' },
  flagged: { bg: '#fee2e2', fg: '#991b1b' },
  rejected: { bg: '#fecaca', fg: '#7f1d1d' },
};

export function formatDistance(distanceMeters: number | null): string {
  if (distanceMeters == null) return 'Location not provided';
  if (distanceMeters < 1000) return `${distanceMeters}m from site`;
  return `${(distanceMeters / 1000).toFixed(1)}km from site`;
}

interface Props {
  report: ReportVerification | null;
}

export default function VerificationBadges({ report }: Props) {
  if (!report) return null;
  const statusColor = STATUS_COLORS[report.status] ?? { bg: '#e2e8f0', fg: '#334155' };
  const forensicsLabel = FORENSICS_LABELS[report.forensics_verdict];

  return (
    <View style={styles.row} testID="verification-badges">
      <View style={[styles.pill, { backgroundColor: statusColor.bg }]}>
        <Text style={[styles.pillText, { color: statusColor.fg }]} testID="badge-status">
          {STATUS_LABELS[report.status] ?? report.status}
        </Text>
      </View>
      <View
        style={[styles.pill, { backgroundColor: report.geofence_pass ? '#ecfdf5' : '#f1f5f9' }]}
      >
        <Text
          style={[styles.pillText, { color: report.geofence_pass ? '#065f46' : '#475569' }]}
          testID="badge-distance"
        >
          {formatDistance(report.distance_meters)}
        </Text>
      </View>
      {forensicsLabel ? (
        <View style={styles.pill}>
          <Text style={styles.pillText} testID="badge-forensics">{forensicsLabel}</Text>
        </View>
      ) : null}
      <View style={[styles.pill, { backgroundColor: '#e0f2fe' }]}>
        <Text style={[styles.pillText, { color: '#075985' }]} testID="badge-reputation">
          {`Reporter: ${report.reporter_reputation}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  pill: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },
});
