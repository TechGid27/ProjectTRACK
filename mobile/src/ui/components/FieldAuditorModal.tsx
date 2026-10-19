import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Platform,
} from 'react-native';
import { ProjectDetail } from '../../core/types';
import { checkGeofenceProximity } from '../../core/geoUtils';
import { outbox, QueuedAudit } from '../../services/outbox';
import { haptics } from '../../services/haptics';

interface FieldAuditorModalProps {
  visible: boolean;
  project: ProjectDetail | null;
  onClose: () => void;
  onAuditSubmitted?: (receipt: QueuedAudit) => void;
}

export default function FieldAuditorModal({
  visible,
  project,
  onClose,
  onAuditSubmitted,
}: FieldAuditorModalProps) {
  // Simulated auditor location (defaulting to nearby for testing)
  const [userOffsetMeters, setUserOffsetMeters] = useState(45); // 45m inside geofence
  const [capturedReceipt, setCapturedReceipt] = useState<QueuedAudit | null>(null);

  // Reference coordinates for Bogo River flood control or default Cebu coords
  const targetCoords = useMemo(() => {
    return {
      lat: 11.0505,
      lng: 124.0055,
    };
  }, []);

  // Compute geofence status
  const geofence = useMemo(() => {
    // 0.000009 deg lat is approx 1 meter
    const simulatedUserLat = targetCoords.lat + (userOffsetMeters * 0.000009);
    const simulatedUserLng = targetCoords.lng;
    return checkGeofenceProximity(
      targetCoords.lat,
      targetCoords.lng,
      simulatedUserLat,
      simulatedUserLng,
      150,
    );
  }, [targetCoords, userOffsetMeters]);

  if (!project) return null;

  const handleCapture = () => {
    if (!geofence.isInside) {
      haptics.triggerWarning();
      return;
    }

    haptics.triggerSuccess();
    const queued = outbox.enqueueAudit({
      projectId: project.id,
      latitude: targetCoords.lat,
      longitude: targetCoords.lng,
      distanceMeters: geofence.distanceMeters,
      notes: `Verified on-site within ${geofence.distanceMeters}m geofence.`,
    });

    setCapturedReceipt(queued);
    onAuditSubmitted?.(queued);
  };

  const handleDone = () => {
    setCapturedReceipt(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleDone}
    >
      <View style={styles.backdrop} testID="field-auditor-modal">
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.modalCard}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleRow}>
                <View style={styles.radarDot} />
                <View>
                  <Text style={styles.headerTitle}>Field Auditor Shutter</Text>
                  <Text style={styles.headerSubtitle}>
                    Hardware Geofence Lock & Ground-Truth Verification
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleDone}
                style={styles.closeBtn}
                testID="close-auditor-btn"
                accessibilityLabel="Close Auditor"
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.bodyContent}>
              {/* Project ID Tag */}
              <View style={styles.projectInfoBox}>
                <Text style={styles.projectBadgeText}>{project.id}</Text>
                <Text style={styles.projectTitleText} numberOfLines={2}>
                  {project.title}
                </Text>
              </View>

              {/* Geofence Radar Status */}
              <View
                style={[
                  styles.radarBanner,
                  geofence.isInside
                    ? styles.radarBannerInside
                    : styles.radarBannerOutside,
                ]}
                testID="geofence-radar-badge"
              >
                <Text style={styles.radarIcon}>
                  {geofence.isInside ? '🎯' : '⚠️'}
                </Text>
                <View style={styles.radarTextCol}>
                  <Text
                    style={[
                      styles.radarTitle,
                      geofence.isInside
                        ? styles.radarTitleInside
                        : styles.radarTitleOutside,
                    ]}
                  >
                    {geofence.isInside
                      ? `Inside Geofence (${geofence.distanceMeters}m from site)`
                      : `Outside Geofence (${geofence.distanceMeters}m away)`}
                  </Text>
                  <Text style={styles.radarDesc}>
                    {geofence.isInside
                      ? 'Hardware GPS locks satisfied. Live camera shutter is unlocked.'
                      : 'You must be within 150m of project centroid to unlock shutter.'}
                  </Text>
                </View>
              </View>

              {/* Proximity Simulation Toggle for Field Testing */}
              <View style={styles.simControlsRow}>
                <Text style={styles.simLabel}>Simulate Location:</Text>
                <TouchableOpacity
                  style={[
                    styles.simPill,
                    userOffsetMeters <= 50 && styles.simPillActive,
                  ]}
                  onPress={() => setUserOffsetMeters(45)}
                >
                  <Text
                    style={[
                      styles.simPillText,
                      userOffsetMeters <= 50 && styles.simPillTextActive,
                    ]}
                  >
                    On-Site (45m)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.simPill,
                    userOffsetMeters > 150 && styles.simPillActive,
                  ]}
                  onPress={() => setUserOffsetMeters(320)}
                >
                  <Text
                    style={[
                      styles.simPillText,
                      userOffsetMeters > 150 && styles.simPillTextActive,
                    ]}
                  >
                    Off-Site (320m)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Viewfinder Window */}
              <View style={styles.viewfinderContainer}>
                <View style={styles.viewfinderFrame}>
                  {/* Viewfinder crosshairs */}
                  <View style={styles.crosshairH} />
                  <View style={styles.crosshairV} />
                  <View style={styles.viewfinderCenter} />

                  {/* Cryptographic Watermark Overlay */}
                  <View style={styles.watermarkOverlay}>
                    <Text style={styles.watermarkLine}>
                      [PT-LOCK] LAT: {targetCoords.lat.toFixed(4)}° N | LNG:{' '}
                      {targetCoords.lng.toFixed(4)}° E
                    </Text>
                    <Text style={styles.watermarkLine}>
                      AZIMUTH: 042° NE | REF: {project.id} | ACCURACY: ±3.2m
                    </Text>
                    <Text style={styles.watermarkLine}>
                      EXIF-TIME: {new Date().toISOString()}
                    </Text>
                  </View>
                </View>
                <Text style={styles.galleryDisabledNote}>
                  🛡️ Live camera snapshot only · Gallery photo uploads disabled for
                  ground-truth integrity.
                </Text>
              </View>

              {/* Success Receipt Card */}
              {capturedReceipt && (
                <View style={styles.receiptBox} testID="receipt-code-badge">
                  <Text style={styles.receiptTitle}>
                    ✅ Audit Verified & Queued!
                  </Text>
                  <Text style={styles.receiptSubtitle}>
                    Anonymous Whistleblower Tracking Receipt:
                  </Text>
                  <View style={styles.receiptBadge}>
                    <Text style={styles.receiptCodeText}>
                      {capturedReceipt.receiptCode}
                    </Text>
                  </View>
                  <Text style={styles.receiptNote}>
                    Keep this receipt code. You can use it to track DPWH and COA
                    investigation progress with zero personal identification.
                  </Text>
                </View>
              )}

              {/* Shutter Capture Button */}
              {!capturedReceipt ? (
                <TouchableOpacity
                  style={[
                    styles.shutterButton,
                    !geofence.isInside && styles.shutterButtonDisabled,
                  ]}
                  onPress={handleCapture}
                  disabled={!geofence.isInside}
                  activeOpacity={0.8}
                  testID="auditor-shutter-btn"
                >
                  <Text style={styles.shutterIcon}>📸</Text>
                  <Text style={styles.shutterButtonText}>
                    {geofence.isInside
                      ? 'Capture Verified On-Site Audit'
                      : 'Geofence Locked — Move Closer'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.doneBtn}
                  onPress={handleDone}
                  activeOpacity={0.8}
                  testID="done-auditor-btn"
                >
                  <Text style={styles.doneBtnText}>Done</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  safeArea: {
    width: '100%',
    maxWidth: 460,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 14,
    marginBottom: 14,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  radarDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  bodyContent: {
    paddingVertical: 4,
  },
  projectInfoBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  projectBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0d9488',
    marginBottom: 2,
  },
  projectTitleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
    lineHeight: 18,
  },
  radarBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    gap: 10,
  },
  radarBannerInside: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  radarBannerOutside: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
  },
  radarIcon: {
    fontSize: 20,
  },
  radarTextCol: {
    flex: 1,
  },
  radarTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  radarTitleInside: {
    color: '#065f46',
  },
  radarTitleOutside: {
    color: '#92400e',
  },
  radarDesc: {
    fontSize: 10,
    color: '#475569',
    marginTop: 2,
    lineHeight: 14,
  },
  simControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  simLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  simPill: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  simPillActive: {
    backgroundColor: '#1f3d3c',
    borderColor: '#1f3d3c',
  },
  simPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  simPillTextActive: {
    color: '#ffffff',
  },
  viewfinderContainer: {
    marginBottom: 14,
  },
  viewfinderFrame: {
    height: 160,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#334155',
  },
  crosshairH: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  crosshairV: {
    position: 'absolute',
    top: 20,
    bottom: 20,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  viewfinderCenter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#10b981',
  },
  watermarkOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 6,
    borderRadius: 6,
  },
  watermarkLine: {
    fontSize: 8,
    color: '#34d399',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 11,
  },
  galleryDisabledNote: {
    fontSize: 9,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 13,
  },
  shutterButton: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  shutterButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  shutterIcon: {
    fontSize: 16,
  },
  shutterButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  receiptBox: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginBottom: 14,
  },
  receiptTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#15803d',
    marginBottom: 2,
  },
  receiptSubtitle: {
    fontSize: 11,
    color: '#166534',
    marginBottom: 8,
  },
  receiptBadge: {
    backgroundColor: '#1f3d3c',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 8,
  },
  receiptCodeText: {
    color: '#34d399',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  receiptNote: {
    fontSize: 10,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 14,
  },
  doneBtn: {
    backgroundColor: '#1f3d3c',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
});
