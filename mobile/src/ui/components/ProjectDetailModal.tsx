import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { ProjectDetail, ProjectStatus } from '../../core/types';
import { formatCurrencyPHP } from '../../core/geoUtils';

interface ProjectDetailModalProps {
  visible: boolean;
  project: ProjectDetail | null;
  onClose: () => void;
  onReportAnomaly: (project: ProjectDetail) => void;
}

export default function ProjectDetailModal({
  visible,
  project,
  onClose,
  onReportAnomaly,
}: ProjectDetailModalProps) {
  if (!project) return null;

  const getStatusColor = (status: ProjectStatus) => {
    switch (status) {
      case 'Completed':
        return { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' };
      case 'Delayed':
        return { bg: '#fef3c7', text: '#92400e', border: '#fde68a' };
      default:
        return { bg: '#e6fffa', text: '#0d9488', border: '#99f6e4' };
    }
  };

  const statusStyle = getStatusColor(project.status);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.modalCard} testID="project-detail-modal">
            {/* Header with Close */}
            <View style={styles.header}>
              <View style={styles.headerTitleRow}>
                <Text style={styles.projectIdBadge}>{project.id}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: statusStyle.bg,
                      borderColor: statusStyle.border,
                    },
                  ]}
                >
                  <Text style={[styles.statusText, { color: statusStyle.text }]}>
                    {project.status}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                accessibilityLabel="Close details"
                accessibilityRole="button"
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.content}
              showsVerticalScrollIndicator={false}
            >
              {/* Main Title */}
              <Text style={styles.title}>{project.title}</Text>

              {/* Location Badge */}
              <View style={styles.infoRow}>
                <Text style={styles.infoIcon}>📍</Text>
                <Text style={styles.locationText}>
                  {project.lgu}
                  {project.barangay ? `, ${project.barangay}` : ''}
                </Text>
              </View>

              {/* Metrics Grid */}
              <View style={styles.grid}>
                <View style={styles.gridCard}>
                  <Text style={styles.gridLabel}>Contract Amount</Text>
                  <Text style={styles.gridValue}>
                    {formatCurrencyPHP(project.budget)}
                  </Text>
                </View>

                <View style={styles.gridCard}>
                  <Text style={styles.gridLabel}>Contractor</Text>
                  <Text style={styles.gridValueSmall}>{project.contractor}</Text>
                </View>
              </View>

              {/* Timeline Section */}
              <View style={styles.section}>
                <Text style={styles.sectionHeader}>Project Schedule</Text>
                <View style={styles.timelineRow}>
                  <View style={styles.timelineCol}>
                    <Text style={styles.timelineLabel}>Start Date</Text>
                    <Text style={styles.timelineValue}>
                      {project.startDate || 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.timelineCol}>
                    <Text style={styles.timelineLabel}>Target Completion</Text>
                    <Text style={styles.timelineValue}>
                      {project.targetCompletion || 'N/A'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Scope Section */}
              {project.scope && (
                <View style={styles.section}>
                  <Text style={styles.sectionHeader}>Scope of Work</Text>
                  <Text style={styles.scopeBody}>{project.scope}</Text>
                </View>
              )}
            </ScrollView>

            {/* Action Bar */}
            <View style={styles.actionBar}>
              <TouchableOpacity
                style={styles.reportAnomalyBtn}
                onPress={() => onReportAnomaly(project)}
                activeOpacity={0.8}
              >
                <Text style={styles.reportAnomalyBtnText}>
                  Report Anomaly on this Project
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  safeArea: {
    maxHeight: '85%',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  projectIdBadge: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1f3d3c',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },
  closeBtnText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '700',
  },
  content: {
    maxHeight: 380,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 24,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 6,
  },
  infoIcon: {
    fontSize: 14,
  },
  locationText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  grid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  gridCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  gridLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
  },
  gridValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0d9488',
  },
  gridValueSmall: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timelineRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  timelineCol: {
    flex: 1,
  },
  timelineLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  timelineValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 2,
  },
  scopeBody: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  actionBar: {
    paddingTop: 12,
  },
  reportAnomalyBtn: {
    backgroundColor: '#b91c1c',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#b91c1c',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  reportAnomalyBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
