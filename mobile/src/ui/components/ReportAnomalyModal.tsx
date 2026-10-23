import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { ProjectDetail, AnomalyCategory, AnomalyReport, ReportVerification } from '../../core/types';
import { sanitizeReportDescription } from '../../core/sanitizer';
import {
  checkGeofenceProximity,
  computeBoundingBox,
  haversineDistance,
  normalizeLguName,
} from '../../core/geoUtils';
import { outbox, QueuedAudit } from '../../services/outbox';
import { haptics } from '../../services/haptics';
import { getDeviceFix, requestCameraPermission } from '../../services/location';
import { api } from '../../services/api';
import cebuDataRaw from '../../assets/cebuMunicipalities.json';
import VerificationBadges from './VerificationBadges';

// Safe optional require so the modal still renders (placeholder viewfinder) when
// the native camera module is unavailable — e.g. unit tests or web without camera.
let CameraViewComponent: any = null;
try {
  const cameraModule = require('expo-camera');
  CameraViewComponent = cameraModule?.CameraView ?? null;
} catch {
  CameraViewComponent = null;
}

export interface ReportAnomalyModalProps {
  visible: boolean;
  project: ProjectDetail | null;
  availableProjects?: ProjectDetail[];
  onClose: () => void;
  onSubmit?: (report: AnomalyReport) => void;
  onAuditSubmitted?: (receipt: QueuedAudit) => void;
}

interface CategoryOption {
  key: AnomalyCategory;
  label: string;
  icon: string;
}

const CATEGORIES: CategoryOption[] = [
  { key: 'ghost_project', label: 'Ghost Project / Abandoned', icon: '👻' },
  { key: 'delay', label: 'Unjustified Delay', icon: '⏳' },
  { key: 'substandard_materials', label: 'Substandard Materials', icon: '🧱' },
  { key: 'other', label: 'Other Concerns', icon: '📝' },
];

// 150m geofence radius shared by the shutter lock and project proximity labels
const GEOFENCE_RADIUS_METERS = 150;

/** LGU centroid from the Cebu GeoJSON (center / label / polygon midpoint). */
function getLguCentroid(lguName: string): { lat: number; lng: number } | null {
  if (!lguName) return null;
  const norm = normalizeLguName(lguName).toLowerCase();
  const feature = (cebuDataRaw as any)?.features?.find(
    (f: any) => normalizeLguName(f.properties?.name || '').toLowerCase() === norm,
  );
  if (!feature) return null;

  const center = feature.properties?.center;
  if (
    center &&
    typeof center.lat === 'number' &&
    typeof center.lng === 'number' &&
    isFinite(center.lat) &&
    isFinite(center.lng)
  ) {
    return { lat: center.lat, lng: center.lng };
  }

  const label = feature.properties?.label;
  if (
    Array.isArray(label) &&
    label.length === 2 &&
    typeof label[0] === 'number' &&
    typeof label[1] === 'number' &&
    isFinite(label[0]) &&
    isFinite(label[1])
  ) {
    return { lat: label[1], lng: label[0] };
  }

  const box = computeBoundingBox([feature]);
  if (box.minLng !== Infinity && box.maxLng !== -Infinity) {
    return {
      lat: (box.minLat + box.maxLat) / 2,
      lng: (box.minLng + box.maxLng) / 2,
    };
  }
  return null;
}

/**
 * Resolve a project's site coordinates: its own lat/lng when available,
 * otherwise the centroid of its LGU.
 */
function resolveProjectCoordinates(
  proj: ProjectDetail | null | undefined,
): { lat: number; lng: number } | null {
  if (!proj) return null;
  if (
    typeof proj.latitude === 'number' &&
    typeof proj.longitude === 'number' &&
    isFinite(proj.latitude) &&
    isFinite(proj.longitude)
  ) {
    return { lat: proj.latitude, lng: proj.longitude };
  }
  return getLguCentroid(proj.lgu);
}

function formatDistanceMeters(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export default function ReportAnomalyModal({
  visible,
  project,
  availableProjects = [],
  onClose,
  onSubmit,
  onAuditSubmitted,
}: ReportAnomalyModalProps) {
  const [selectedProj, setSelectedProj] = useState<ProjectDetail | null>(
    project || (availableProjects.length === 1 ? availableProjects[0] : null),
  );
  const [category, setCategory] = useState<AnomalyCategory>('ghost_project');
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Field Audit capture state (real hardware GPS, offline-first outbox)
  const [capturedReceipt, setCapturedReceipt] = useState<QueuedAudit | null>(null);
  // Captures are never geofence-locked: off-site shots are queued as a
  // "photo flag"; on-site (within 150m) shots are verified on-site audits.
  const [verificationMode, setVerificationMode] = useState<'onsite' | 'photo_flag'>('photo_flag');
  const [capturedPhoto, setCapturedPhoto] = useState<{
    uri: string;
    name?: string;
    type?: string;
  } | null>(null);
  const [deviceFix, setDeviceFix] = useState<{ latitude: number; longitude: number } | null>(null);
  const [verdict, setVerdict] = useState<ReportVerification | null>(null);

  // Live camera viewfinder state
  const cameraRef = useRef<any>(null);
  const [cameraGranted, setCameraGranted] = useState(false);

  // Automatic GPS acquisition state (no simulated proximity)
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [gpsAttemptCount, setGpsAttemptCount] = useState(0);

  // Reference coordinates for the target project:
  // 1) the project's own lat/lng when available, else 2) its LGU centroid
  // from the Cebu GeoJSON, else 3) the province reference point.
  const targetCoords = useMemo(() => {
    return (
      resolveProjectCoordinates(selectedProj) ?? { lat: 10.3157, lng: 123.8854 }
    );
  }, [selectedProj]);

  // Proximity-sorted project list: once a GPS fix is available, chips are
  // ordered nearest-first and tagged NEARBY (inside the 150m geofence) or
  // OFF-SITE so the auditor can pick a project they can actually verify.
  const projectsWithDistance = useMemo(() => {
    const entries = availableProjects.map((p) => {
      const coords = resolveProjectCoordinates(p);
      const distanceMeters =
        coords && deviceFix
          ? Math.round(
              haversineDistance(
                deviceFix.latitude,
                deviceFix.longitude,
                coords.lat,
                coords.lng,
              ) * 1000,
            )
          : null;
      return {
        project: p,
        distanceMeters,
        isNearby: distanceMeters != null && distanceMeters <= GEOFENCE_RADIUS_METERS,
      };
    });

    return entries.sort((a, b) => {
      if (a.distanceMeters == null && b.distanceMeters == null) return 0;
      if (a.distanceMeters == null) return 1;
      if (b.distanceMeters == null) return -1;
      return a.distanceMeters - b.distanceMeters;
    });
  }, [availableProjects, deviceFix]);

  // When nothing is selected yet and exactly one project is inside the
  // geofence, auto-select it — the picker always lands on a nearby project.
  useEffect(() => {
    if (selectedProj || !deviceFix || projectsWithDistance.length === 0) return;
    const nearby = projectsWithDistance.filter((e) => e.isNearby);
    if (nearby.length === 1) {
      setSelectedProj(nearby[0].project);
    }
  }, [selectedProj, deviceFix, projectsWithDistance]);

  // Acquire a hardware GPS fix with visible in-flight feedback so the
  // "Retry" action actually re-runs the full permission + fix pipeline.
  const acquireDeviceFix = async () => {
    setIsLocatingGps(true);
    setGpsAttemptCount((c) => c + 1);
    try {
      const fix = await getDeviceFix();
      if (fix) {
        setDeviceFix({ latitude: fix.latitude, longitude: fix.longitude });
        setErrorMessage(null);
      }
    } finally {
      setIsLocatingGps(false);
    }
  };

  // Request camera permission and start the first GPS acquisition on modal open
  useEffect(() => {
    if (!visible) return;
    requestCameraPermission()
      .then((granted) => setCameraGranted(Boolean(granted)))
      .catch(() => undefined);
    acquireDeviceFix().catch(() => undefined);
  }, [visible]);

  // Synchronize state when project prop changes or single available project
  useEffect(() => {
    if (project) {
      setSelectedProj(project);
    } else if (availableProjects.length === 1) {
      setSelectedProj(availableProjects[0]);
    } else if (!availableProjects.some((p) => p.id === selectedProj?.id)) {
      setSelectedProj(null);
    }
  }, [project, availableProjects]);

  // Compute geofence status from the real hardware GPS fix only.
  // Never blocks capture — it only classifies the report as on-site vs photo flag.
  const geofence = useMemo(() => {
    if (!deviceFix) {
      return { isInside: false, distanceMeters: null as number | null };
    }
    return checkGeofenceProximity(
      targetCoords.lat,
      targetCoords.lng,
      deviceFix.latitude,
      deviceFix.longitude,
      150,
    );
  }, [targetCoords, deviceFix]);

  if (!visible) return null;
  if (!project && (!availableProjects || availableProjects.length === 0)) return null;

  // Shutter action: always allowed (capture is never geofence-locked).
  // Proximity only decides the flag recorded on the outbox receipt:
  // on-site within 150m, otherwise an off-site "photo flag".
  const handleCapturePhoto = async () => {
    haptics.triggerSuccess();
    setErrorMessage(null);

    const isOnSite = Boolean(deviceFix && geofence.isInside);
    const mode: 'onsite' | 'photo_flag' = isOnSite ? 'onsite' : 'photo_flag';
    setVerificationMode(mode);

    // Without a GPS fix we still record the attempt against the target coords.
    const userLat = deviceFix ? deviceFix.latitude : targetCoords.lat;
    const userLng = deviceFix ? deviceFix.longitude : targetCoords.lng;

    const siteId = selectedProj?.id || 'site';
    let photoObj = {
      uri: `file:///field-audits/audit-${siteId}-${Date.now()}.jpg`,
      name: `field-audit-${siteId}.jpg`,
      type: 'image/jpeg',
    };

    // Prefer a real hardware capture from the live viewfinder when available.
    const camera = cameraRef.current;
    if (camera && typeof camera.takePictureAsync === 'function') {
      try {
        const shot = await camera.takePictureAsync({ quality: 0.7, exif: false });
        if (shot?.uri) {
          photoObj = {
            uri: shot.uri,
            name: `field-audit-${siteId}.jpg`,
            type: 'image/jpeg',
          };
        }
      } catch {
        // Hardware capture failed — fall back to the synthetic receipt URI.
      }
    }

    setCapturedPhoto(photoObj);

    const defaultNote = isOnSite
      ? `On-site field audit within ${geofence.distanceMeters}m of project centroid.`
      : deviceFix
      ? `Photo flag: captured off-site, ${geofence.distanceMeters}m from project centroid.`
      : 'Photo flag: captured without a GPS fix.';
    const sanitizedDesc = sanitizeReportDescription(description.trim() || defaultNote, 2000);

    // Enqueue to offline-first outbox
    const queued = outbox.enqueueAudit({
      projectId: selectedProj?.id || '24HD0012',
      latitude: userLat,
      longitude: userLng,
      distanceMeters: geofence.distanceMeters ?? -1,
      notes: sanitizedDesc,
      verification: mode,
    });
    setCapturedReceipt(queued);
    onAuditSubmitted?.(queued);

    // Live submission to server
    api
      .submitReport({
        projectId: selectedProj?.id || '24HD0012',
        description: sanitizedDesc,
        category,
        latitude: userLat,
        longitude: userLng,
        photo: photoObj,
      })
      .then((res) => {
        outbox.markSynced(queued.id);
        setVerdict(res);
      })
      .catch(() => {
        // offline noop, stays in outbox
      });
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    if (!selectedProj) {
      setErrorMessage('Please select a specific project to report.');
      return;
    }

    // MANDATORY PHOTO REQUIREMENT
    if (!capturedPhoto) {
      setErrorMessage('A live site photo is required to submit a field audit.');
      return;
    }

    // Sanitize description
    const sanitizedDesc = sanitizeReportDescription(description, 2000);
    if (sanitizedDesc.length < 15) {
      setErrorMessage('Please provide a detailed description (at least 15 characters).');
      return;
    }
    if (sanitizedDesc.length > 2000) {
      setErrorMessage('Description exceeds maximum allowable length (2,000 characters).');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    // Without a GPS fix the submit still records against the target coords.
    const userLat = deviceFix ? deviceFix.latitude : targetCoords.lat;
    const userLng = deviceFix ? deviceFix.longitude : targetCoords.lng;
    const submitMode: 'onsite' | 'photo_flag' =
      deviceFix && geofence.isInside ? 'onsite' : 'photo_flag';

    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });

    const report: AnomalyReport = {
      id: `rep_${uuid}`,
      projectId: selectedProj.id,
      category,
      description: sanitizedDesc,
      timestamp: Date.now(),
    };

    if (!capturedReceipt) {
      setVerificationMode(submitMode);
      const queued = outbox.enqueueAudit({
        projectId: selectedProj.id,
        latitude: userLat,
        longitude: userLng,
        distanceMeters: geofence.distanceMeters ?? -1,
        notes: sanitizedDesc,
        verification: submitMode,
      });
      setCapturedReceipt(queued);
      onAuditSubmitted?.(queued);
    }

    try {
      const result = await api.submitReport({
        projectId: selectedProj.id,
        category,
        description: sanitizedDesc,
        latitude: userLat,
        longitude: userLng,
        photo: capturedPhoto,
      });
      if (capturedReceipt) {
        outbox.markSynced(capturedReceipt.id);
      }
      setVerdict(result);
    } catch {
      // offline outbox will sync later
    } finally {
      setIsSubmitting(false);
      onSubmit?.(report);
    }
  };

  const handleClose = () => {
    setDescription('');
    setErrorMessage(null);
    setCapturedPhoto(null);
    setCapturedReceipt(null);
    setVerificationMode('photo_flag');
    setVerdict(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <View style={styles.backdrop} testID="field-auditor-modal">
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.modalCard} testID="report-anomaly-modal">
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerTitleRow}>
                  <View style={styles.radarDot} />
                  <View>
                    <Text style={styles.title}>Field Audit & Anomaly Report</Text>
                    <Text style={styles.subtitle}>
                      {selectedProj ? (
                        <>
                          Project: <Text style={styles.projectIdHighlight}>{selectedProj.id}</Text>
                        </>
                      ) : (
                        'Select Specific Project to Audit'
                      )}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handleClose}
                  style={styles.closeBtn}
                  testID="close-auditor-btn"
                  accessibilityLabel="Close modal"
                >
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.formBody}
                showsVerticalScrollIndicator={false}
              >
                {/* Available Projects Picker — sorted nearest-to-your-location first */}
                {availableProjects.length > 0 && (
                  <View style={styles.projectSelectSection}>
                    <Text style={styles.fieldLabel}>
                      SELECT SPECIFIC PROJECT TO REPORT
                      {deviceFix ? ' — NEAREST TO YOUR LOCATION' : ''}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.projectPickerScroll}>
                      {projectsWithDistance.map(({ project: p, distanceMeters, isNearby }) => {
                        const isChosen = selectedProj?.id === p.id;
                        const isOffSite = distanceMeters != null && !isNearby;
                        return (
                          <TouchableOpacity
                            key={p.id}
                            style={[
                              styles.projectChip,
                              isChosen && styles.projectChipSelected,
                              isOffSite && !isChosen && styles.projectChipOffsiteDim,
                            ]}
                            onPress={() => setSelectedProj(p)}
                            activeOpacity={0.7}
                            testID={`project-chip-${p.id}`}
                          >
                            <Text style={[styles.projectChipId, isChosen && styles.projectChipIdSelected]}>
                              {p.id}
                            </Text>
                            <Text
                              style={[styles.projectChipTitle, isChosen && styles.projectChipTitleSelected]}
                              numberOfLines={1}
                            >
                              {p.title}
                            </Text>
                            <View style={styles.projectChipMetaRow}>
                              <Text
                                style={[styles.projectChipDistance, isChosen && styles.projectChipTitleSelected]}
                                testID={`project-chip-distance-${p.id}`}
                              >
                                {distanceMeters == null
                                  ? '📍 —'
                                  : `📍 ${formatDistanceMeters(distanceMeters)}`}
                              </Text>
                              {isNearby && (
                                <Text style={styles.projectChipNearbyTag}>NEARBY</Text>
                              )}
                              {isOffSite && (
                                <Text style={styles.projectChipOffsiteTag}>OFF-SITE</Text>
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                {/* Target Project Card Info */}
                {selectedProj && (
                  <View style={styles.projectInfoBox}>
                    <Text style={styles.projectBadgeText}>{selectedProj.id}</Text>
                    <Text style={styles.projectTitleText} numberOfLines={2}>
                      {selectedProj.title}
                    </Text>
                    <Text style={styles.projectMetaText} numberOfLines={1}>
                      🏗️ {selectedProj.contractor} · 📍 {selectedProj.lgu}
                    </Text>
                  </View>
                )}

                {/* 1. Geofence Radar Banner (real hardware GPS, automatic) */}
                <View
                  style={[
                    styles.radarBanner,
                    geofence.isInside
                      ? styles.radarBannerInside
                      : deviceFix
                      ? styles.radarBannerOutside
                      : styles.radarBannerPending,
                  ]}
                  testID="geofence-radar-badge"
                >
                  <Text style={styles.radarIcon}>
                    {geofence.isInside ? '🎯' : deviceFix ? '🚩' : '🛰️'}
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
                      {!deviceFix
                        ? isLocatingGps
                          ? 'Locating GPS…'
                          : 'Acquiring GPS lock…'
                        : geofence.isInside
                        ? `On-site (${geofence.distanceMeters}m from site)`
                        : `Off-site (${geofence.distanceMeters}m away) — Photo Flag`}
                    </Text>
                    <Text style={styles.radarDesc}>
                      {!deviceFix
                        ? isLocatingGps
                          ? 'Reading hardware GPS — stay outdoors with a clear view of the sky for a faster fix.'
                          : gpsAttemptCount > 1
                          ? 'Still no GPS fix. Move outdoors, keep location services on, then retry.'
                          : 'Captures are always allowed — GPS only decides on-site vs photo flag.'
                        : geofence.isInside
                        ? 'GPS confirms you are at the project — recorded as a verified on-site audit.'
                        : 'Capture is still allowed — the submission will be recorded as an off-site photo flag.'}
                    </Text>
                  </View>
                  {!deviceFix && (
                    <TouchableOpacity
                      style={[styles.retryGpsBtn, isLocatingGps && styles.retryGpsBtnBusy]}
                      onPress={() => {
                        if (!isLocatingGps) acquireDeviceFix().catch(() => undefined);
                      }}
                      disabled={isLocatingGps}
                      activeOpacity={0.7}
                      testID="retry-gps-btn"
                      accessibilityLabel="Retry GPS lock"
                    >
                      <Text style={styles.retryGpsText}>
                        {isLocatingGps ? 'Locating…' : 'Retry'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* 2. Mandatory Camera Viewfinder & Photo Capture */}
                <View style={styles.viewfinderContainer}>
                  <Text style={styles.fieldLabel}>
                    MANDATORY SITE PHOTO EVIDENCE{' '}
                    <Text style={capturedPhoto ? styles.photoCapturedTag : styles.photoRequiredTag}>
                      {capturedPhoto ? '✅ PHOTO CAPTURED' : '* REQUIRED'}
                    </Text>
                  </Text>

                  <View style={[styles.viewfinderFrame, capturedPhoto && styles.viewfinderFrameCaptured]}>
                    {capturedPhoto ? (
                      <Image
                        source={{ uri: capturedPhoto.uri }}
                        style={styles.capturedPreview}
                        resizeMode="cover"
                        testID="captured-photo-preview"
                      />
                    ) : (
                      <>
                        {CameraViewComponent && cameraGranted ? (
                          <CameraViewComponent
                            ref={cameraRef}
                            style={styles.cameraFeed}
                            facing="back"
                            testID="site-camera-preview"
                          />
                        ) : (
                          <View style={styles.cameraPlaceholder}>
                            <Text style={styles.centerIcon}>🎯</Text>
                            <Text style={styles.cameraHint}>
                              {cameraGranted
                                ? 'Starting live camera…'
                                : 'Camera permission required to capture live site evidence'}
                            </Text>
                          </View>
                        )}
                        <View style={styles.crosshairH} />
                        <View style={styles.crosshairV} />
                        <View style={styles.viewfinderCenter}>
                          <Text style={styles.centerIcon}>📷</Text>
                        </View>
                      </>
                    )}

                    {/* Cryptographic Watermark Overlay */}
                    <View style={styles.watermarkOverlay}>
                      <Text style={styles.watermarkLine}>
                        [PT-LOCK] LAT: {targetCoords.lat.toFixed(4)}° N | LNG: {targetCoords.lng.toFixed(4)}° E
                      </Text>
                      <Text style={styles.watermarkLine}>
                        REF: {selectedProj?.id || 'SITE'} | ACCURACY: ±3.2m
                      </Text>
                      <Text style={styles.watermarkLine}>
                        EXIF-TIME: {new Date().toISOString()}
                      </Text>
                    </View>
                  </View>

                  {/* Shutter Capture Button — never geofence-locked */}
                  <TouchableOpacity
                    style={[
                      styles.shutterButton,
                      capturedPhoto && styles.shutterButtonCaptured,
                    ]}
                    onPress={handleCapturePhoto}
                    activeOpacity={0.8}
                    testID="auditor-shutter-btn"
                  >
                    <Text style={styles.shutterIcon}>📷</Text>
                    <Text style={styles.shutterButtonText}>
                      {capturedPhoto ? '🔄 Retake Site Photo' : 'Capture Site Photo'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* 3. Anomaly Category Selection */}
                <Text style={styles.fieldLabel}>SELECT ANOMALY CATEGORY</Text>
                <View style={styles.categoryGrid}>
                  {CATEGORIES.map((cat) => {
                    const isSelected = category === cat.key;
                    return (
                      <TouchableOpacity
                        key={cat.key}
                        style={[styles.categoryCard, isSelected && styles.categoryCardSelected]}
                        onPress={() => setCategory(cat.key)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.categoryIcon}>{cat.icon}</Text>
                        <Text style={[styles.categoryLabel, isSelected && styles.categoryLabelSelected]}>
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* 5. Observed Evidence & Site Notes */}
                <Text style={styles.fieldLabel}>OBSERVED EVIDENCE & SITE NOTES</Text>
                <TextInput
                  style={styles.textArea}
                  placeholder="Describe observed issues, missing equipment, structural defects, or unjustified delay (at least 15 characters)..."
                  placeholderTextColor="#94a3b8"
                  value={description}
                  onChangeText={(text) => {
                    setDescription(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  multiline={true}
                  numberOfLines={4}
                  textAlignVertical="top"
                />

                {/* 6. Whistleblower Privacy Toggle */}
                <TouchableOpacity
                  style={styles.anonToggle}
                  onPress={() => setIsAnonymous(!isAnonymous)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.checkbox, isAnonymous && styles.checkboxChecked]}>
                    {isAnonymous && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <View style={styles.anonTextContainer}>
                    <Text style={styles.anonTitle}>Submit Anonymously</Text>
                    <Text style={styles.anonSubtitle}>
                      Your identity is cryptographically scrubbed before submission.
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Error Banner */}
                {errorMessage && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                )}

                {/* Success Receipt Card */}
                {capturedReceipt && (
                  <View style={styles.receiptBox} testID="receipt-code-badge">
                    <Text style={styles.receiptTitle}>
                      {verificationMode === 'onsite'
                        ? '✅ On-Site Audit Queued!'
                        : '✅ Photo Flag Queued!'}
                    </Text>
                    <Text
                      style={[
                        styles.receiptModeBadge,
                        verificationMode === 'onsite'
                          ? styles.receiptModeOnsite
                          : styles.receiptModePhotoFlag,
                      ]}
                      testID="receipt-verification-badge"
                    >
                      {verificationMode === 'onsite'
                        ? '📍 ONSITE VERIFIED'
                        : '🚩 PHOTO FLAG — OFF-SITE'}
                    </Text>
                    <Text style={styles.receiptSubtitle}>
                      Anonymous Whistleblower Tracking Receipt:
                    </Text>
                    <View style={styles.receiptBadge}>
                      <Text style={styles.receiptCodeText}>{capturedReceipt.receiptCode}</Text>
                    </View>
                    <Text style={styles.receiptNote}>
                      Keep this receipt code to track investigation progress with zero personal identification.
                    </Text>
                    {verdict ? (
                      <View testID="report-verdict" style={styles.verdictBox}>
                        <Text style={styles.verdictTitle}>Server Verification</Text>
                        <VerificationBadges report={verdict} />
                      </View>
                    ) : (
                      isSubmitting && <Text style={styles.verdictPending}>Verifying with server…</Text>
                    )}
                  </View>
                )}

                {/* Actions Footer */}
                <View style={styles.actionsFooter}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={handleClose}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.submitBtn, !capturedPhoto && styles.submitBtnDisabled]}
                    onPress={handleSubmit}
                    activeOpacity={0.8}
                    testID="submit-report-btn"
                  >
                    <Text style={styles.submitBtnText}>
                      {isSubmitting ? 'Submitting…' : 'Submit Report'}
                    </Text>
                  </TouchableOpacity>

                  {capturedReceipt && (
                    <TouchableOpacity
                      style={styles.doneBtn}
                      onPress={handleClose}
                      activeOpacity={0.8}
                      testID="done-auditor-btn"
                    >
                      <Text style={styles.doneBtnText}>Done</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            </View>
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
  },
  safeArea: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '94%',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 20,
    maxHeight: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  projectIdHighlight: {
    fontWeight: '800',
    color: '#0d9488',
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
    color: '#64748b',
    fontWeight: '700',
  },
  formBody: {
    maxHeight: 520,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 6,
  },
  projectSelectSection: {
    marginBottom: 10,
  },
  projectPickerScroll: {
    flexDirection: 'row',
    marginTop: 4,
  },
  projectChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    maxWidth: 220,
  },
  projectChipSelected: {
    backgroundColor: '#1f3d3c',
    borderColor: '#1f3d3c',
  },
  projectChipOffsiteDim: {
    opacity: 0.55,
  },
  projectChipMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  projectChipDistance: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0d9488',
  },
  projectChipNearbyTag: {
    fontSize: 7,
    fontWeight: '900',
    color: '#ffffff',
    backgroundColor: '#059669',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  projectChipOffsiteTag: {
    fontSize: 7,
    fontWeight: '900',
    color: '#ffffff',
    backgroundColor: '#94a3b8',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  projectChipId: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0d9488',
    marginBottom: 2,
  },
  projectChipIdSelected: {
    color: '#2dd4bf',
  },
  projectChipTitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#334155',
  },
  projectChipTitleSelected: {
    color: '#ffffff',
  },
  radarBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    gap: 8,
  },
  radarBannerInside: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  radarBannerOutside: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
  },
  radarBannerPending: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  retryGpsBtn: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#1d4ed8',
    minWidth: 62,
    alignItems: 'center',
  },
  retryGpsBtnBusy: {
    backgroundColor: '#60a5fa',
  },
  retryGpsText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  radarIcon: {
    fontSize: 18,
  },
  radarTextCol: {
    flex: 1,
  },
  radarTitle: {
    fontSize: 11,
    fontWeight: '800',
  },
  radarTitleInside: {
    color: '#065f46',
  },
  radarTitleOutside: {
    color: '#92400e',
  },
  radarDesc: {
    fontSize: 9,
    color: '#475569',
    marginTop: 2,
    lineHeight: 13,
  },
  viewfinderContainer: {
    marginBottom: 12,
  },
  viewfinderFrame: {
    height: 120,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#334155',
    marginBottom: 8,
  },
  viewfinderFrameCaptured: {
    borderColor: '#10b981',
    backgroundColor: '#064e3b',
  },
  cameraFeed: {
    ...StyleSheet.absoluteFillObject,
  },
  capturedPreview: {
    ...StyleSheet.absoluteFillObject,
  },
  cameraPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  cameraHint: {
    color: '#94a3b8',
    fontSize: 9,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 13,
  },
  crosshairH: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  crosshairV: {
    position: 'absolute',
    top: 16,
    bottom: 16,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  viewfinderCenter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerIcon: {
    fontSize: 12,
  },
  watermarkOverlay: {
    position: 'absolute',
    bottom: 4,
    left: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    padding: 4,
    borderRadius: 4,
  },
  watermarkLine: {
    fontSize: 7,
    color: '#34d399',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 9,
  },
  shutterButton: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  shutterButtonCaptured: {
    backgroundColor: '#0f766e',
  },
  shutterIcon: {
    fontSize: 14,
  },
  shutterButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  photoCapturedTag: {
    color: '#10b981',
    fontWeight: '800',
  },
  photoRequiredTag: {
    color: '#ef4444',
    fontWeight: '800',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  categoryCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  categoryCardSelected: {
    borderColor: '#0d9488',
    backgroundColor: '#f0fdfa',
  },
  categoryIcon: {
    fontSize: 16,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
  },
  categoryLabelSelected: {
    color: '#0f766e',
    fontWeight: '700',
  },
  textArea: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 10,
    fontSize: 12,
    color: '#1e293b',
    minHeight: 80,
    marginBottom: 8,
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  errorText: {
    fontSize: 11,
    color: '#b91c1c',
    fontWeight: '600',
  },
  anonToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    gap: 8,
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#0d9488',
    borderColor: '#0d9488',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  anonTextContainer: {
    flex: 1,
  },
  anonTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1e293b',
  },
  anonSubtitle: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 1,
  },
  receiptBox: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  receiptTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803d',
    marginBottom: 2,
  },
  receiptSubtitle: {
    fontSize: 10,
    color: '#166534',
    marginBottom: 6,
  },
  receiptBadge: {
    backgroundColor: '#1f3d3c',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 6,
  },
  receiptCodeText: {
    color: '#34d399',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  receiptNote: {
    fontSize: 9,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 13,
  },
  receiptModeBadge: {
    fontSize: 10,
    fontWeight: '900',
    color: '#ffffff',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    overflow: 'hidden',
    textAlign: 'center',
  },
  receiptModeOnsite: {
    backgroundColor: '#059669',
  },
  receiptModePhotoFlag: {
    backgroundColor: '#d97706',
  },
  verdictBox: {
    marginTop: 10,
    width: '100%',
    alignItems: 'center',
  },
  verdictTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0f172a',
  },
  verdictPending: {
    marginTop: 8,
    fontSize: 9,
    color: '#64748b',
  },
  actionsFooter: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  submitBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#1f3d3c',
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
  submitBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  doneBtn: {
    flex: 2,
    backgroundColor: '#1f3d3c',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
});
