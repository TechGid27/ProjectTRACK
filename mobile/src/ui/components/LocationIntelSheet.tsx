import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { ProjectDetail, ProjectStatus } from '../../core/types';
import { formatCurrencyPHP } from '../../core/geoUtils';
import { haptics } from '../../services/haptics';

interface LocationIntelSheetProps {
  lguName: string;
  projects: ProjectDetail[];
  onSelectProject: (project: ProjectDetail) => void;
  onReportAnomaly: (lguName: string) => void;
  onFieldAuditPress?: (project: ProjectDetail) => void;
  onClose?: () => void;
}

type FilterOption = 'All' | ProjectStatus;

export default function LocationIntelSheet({
  lguName,
  projects = [],
  onSelectProject,
  onReportAnomaly,
  onFieldAuditPress,
  onClose,
}: LocationIntelSheetProps) {
  const [selectedFilter, setSelectedFilter] = useState<FilterOption>('All');
  const [votesState, setVotesState] = useState<
    Record<string, { confirm: number; dispute: number; userVoted?: 'confirm' | 'dispute' }>
  >({});

  // Compute summary stats
  const totalBudget = useMemo(() => {
    return projects.reduce((sum, p) => sum + p.budget, 0);
  }, [projects]);

  const ongoingCount = useMemo(() => {
    return projects.filter((p) => p.status === 'Ongoing').length;
  }, [projects]);

  const completedCount = useMemo(() => {
    return projects.filter((p) => p.status === 'Completed').length;
  }, [projects]);

  const delayedCount = useMemo(() => {
    return projects.filter((p) => p.status === 'Delayed').length;
  }, [projects]);

  // Filter projects list
  const filteredProjects = useMemo(() => {
    if (selectedFilter === 'All') return projects;
    return projects.filter((p) => p.status === selectedFilter);
  }, [projects, selectedFilter]);

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

  const { height: windowHeight } = useWindowDimensions();
  const sheetMaxHeight = Math.max(260, (windowHeight || 600) * 0.48);

  return (
    <View
      style={[styles.container, { maxHeight: sheetMaxHeight }]}
      testID="location-intel-sheet"
    >
      {/* Draggable Handle Bar */}
      <TouchableOpacity
        style={styles.handleBarContainer}
        onPress={onClose}
        activeOpacity={0.7}
      >
        <View style={styles.handleBar} />
      </TouchableOpacity>

      {/* Header with Title and Anomaly Action */}
      <View style={styles.headerRow}>
        <View style={styles.titleArea}>
          <Text style={styles.subTitle}>LOCATION INTEL</Text>
          <Text style={styles.lguTitle}>{lguName}</Text>
        </View>

        <TouchableOpacity
          style={styles.anomalyButton}
          onPress={() => onReportAnomaly(lguName)}
          activeOpacity={0.8}
        >
          <Text style={styles.anomalyButtonText}>⚠️ Report Anomaly</Text>
        </TouchableOpacity>
      </View>

      {/* Key Metric Stats Grid */}
      <View style={styles.metricsContainer}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Total Projects</Text>
          <Text style={styles.metricValue}>{projects.length} Projects</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Total Allocation</Text>
          <Text style={[styles.metricValue, { color: '#0d9488' }]}>
            {formatCurrencyPHP(totalBudget)}
          </Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Ongoing / Active</Text>
          <Text style={styles.metricValue}>{ongoingCount}</Text>
        </View>
      </View>

      {/* Filter Chips */}
      <View style={styles.filtersRow}>
        <TouchableOpacity
          style={[
            styles.filterChip,
            selectedFilter === 'All' && styles.filterChipActive,
          ]}
          onPress={() => setSelectedFilter('All')}
        >
          <Text
            style={[
              styles.filterChipText,
              selectedFilter === 'All' && styles.filterChipTextActive,
            ]}
          >
            All ({projects.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterChip,
            selectedFilter === 'Ongoing' && styles.filterChipActive,
          ]}
          onPress={() => setSelectedFilter('Ongoing')}
        >
          <Text
            style={[
              styles.filterChipText,
              selectedFilter === 'Ongoing' && styles.filterChipTextActive,
            ]}
          >
            Ongoing ({ongoingCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterChip,
            selectedFilter === 'Completed' && styles.filterChipActive,
          ]}
          onPress={() => setSelectedFilter('Completed')}
        >
          <Text
            style={[
              styles.filterChipText,
              selectedFilter === 'Completed' && styles.filterChipTextActive,
            ]}
          >
            Completed ({completedCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterChip,
            selectedFilter === 'Delayed' && styles.filterChipActive,
          ]}
          onPress={() => setSelectedFilter('Delayed')}
        >
          <Text
            style={[
              styles.filterChipText,
              selectedFilter === 'Delayed' && styles.filterChipTextActive,
            ]}
          >
            Delayed ({delayedCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Projects List */}
      <ScrollView
        style={styles.projectsList}
        contentContainerStyle={styles.projectsListContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredProjects.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No civil works projects recorded for this area.
            </Text>
          </View>
        ) : (
          filteredProjects.map((project) => {
            const statusStyle = getStatusColor(project.status);
            const cardVotes = votesState[project.id] || { confirm: 14, dispute: 1 };
            return (
              <TouchableOpacity
                key={project.id}
                style={styles.projectCard}
                onPress={() => onSelectProject(project)}
                activeOpacity={0.7}
              >
                <View style={styles.cardTopRow}>
                  <Text style={styles.projectId}>{project.id}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: statusStyle.bg,
                        borderColor: statusStyle.border,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.statusBadgeText, { color: statusStyle.text }]}
                    >
                      {project.status}
                    </Text>
                  </View>
                </View>

                <Text style={styles.projectTitle} numberOfLines={2}>
                  {project.title}
                </Text>

                <View style={styles.cardFooter}>
                  <Text style={styles.contractorName} numberOfLines={1}>
                    🏢 {project.contractor}
                  </Text>
                  <Text style={styles.projectBudget}>
                    {formatCurrencyPHP(project.budget)}
                  </Text>
                </View>

                {/* Milestone Stepper */}
                <View style={styles.milestoneRow}>
                  <View style={[styles.milestoneDot, styles.milestoneDone]} />
                  <View style={styles.milestoneLine} />
                  <View style={[styles.milestoneDot, styles.milestoneDone]} />
                  <View style={styles.milestoneLine} />
                  <View
                    style={[
                      styles.milestoneDot,
                      project.status === 'Completed'
                        ? styles.milestoneDone
                        : styles.milestoneActive,
                    ]}
                  />
                  <View style={styles.milestoneLine} />
                  <View
                    style={[
                      styles.milestoneDot,
                      project.status === 'Completed'
                        ? styles.milestoneDone
                        : styles.milestonePending,
                    ]}
                  />
                  <Text style={styles.milestoneText}>
                    {project.status === 'Completed'
                      ? '100% Completed'
                      : project.status === 'Delayed'
                      ? 'Delayed (45%)'
                      : 'Active (65%)'}
                  </Text>
                </View>

                {/* Crowdsourced Verification Votes & Field Audit */}
                <View style={styles.cardActionsRow}>
                  <View style={styles.voteGroup}>
                    <TouchableOpacity
                      style={[
                        styles.voteBtn,
                        cardVotes.userVoted === 'confirm' && styles.voteBtnActive,
                      ]}
                      onPress={(e) => {
                        e.stopPropagation();
                        haptics.triggerSelection();
                        setVotesState((prev) => {
                          const cur = prev[project.id] || { confirm: 14, dispute: 1 };
                          return {
                            ...prev,
                            [project.id]: {
                              ...cur,
                              confirm: cur.confirm + 1,
                              userVoted: 'confirm',
                            },
                          };
                        });
                      }}
                      testID={`confirm-vote-btn-${project.id}`}
                    >
                      <Text style={styles.voteBtnText}>👍 {cardVotes.confirm}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.voteBtn,
                        cardVotes.userVoted === 'dispute' && styles.voteBtnActive,
                      ]}
                      onPress={(e) => {
                        e.stopPropagation();
                        haptics.triggerSelection();
                        setVotesState((prev) => {
                          const cur = prev[project.id] || { confirm: 14, dispute: 1 };
                          return {
                            ...prev,
                            [project.id]: {
                              ...cur,
                              dispute: cur.dispute + 1,
                              userVoted: 'dispute',
                            },
                          };
                        });
                      }}
                      testID={`dispute-vote-btn-${project.id}`}
                    >
                      <Text style={styles.voteBtnText}>👎 {cardVotes.dispute}</Text>
                    </TouchableOpacity>
                  </View>

                  {onFieldAuditPress && (
                    <TouchableOpacity
                      style={styles.fieldAuditBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        haptics.triggerSelection();
                        onFieldAuditPress(project);
                      }}
                      testID={`field-audit-btn-${project.id}`}
                    >
                      <Text style={styles.fieldAuditBtnText}>📸 Field Audit</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 10,
  },
  handleBarContainer: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  handleBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#cbd5e1',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 10,
  },
  titleArea: {
    flex: 1,
  },
  subTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0d9488',
    letterSpacing: 0.8,
  },
  lguTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1f3d3c',
  },
  anomalyButton: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  anomalyButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b91c1c',
  },
  metricsContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 10,
    marginBottom: 12,
    justifyContent: 'space-between',
  },
  metricCard: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1e293b',
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  filterChipActive: {
    backgroundColor: '#1f3d3c',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  projectsList: {
    flexGrow: 1,
  },
  projectsListContent: {
    paddingBottom: 16,
    gap: 8,
  },
  projectCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  projectId: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  projectTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 18,
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contractorName: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
    flex: 1,
    marginRight: 8,
  },
  projectBudget: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1f3d3c',
  },
  emptyContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 8,
  },
  milestoneDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  milestoneDone: {
    backgroundColor: '#10b981',
  },
  milestoneActive: {
    backgroundColor: '#0ea5e9',
  },
  milestonePending: {
    backgroundColor: '#cbd5e1',
  },
  milestoneLine: {
    width: 14,
    height: 2,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 3,
  },
  milestoneText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    marginLeft: 8,
  },
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  voteGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  voteBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  voteBtnActive: {
    backgroundColor: '#e6fffa',
    borderColor: '#99f6e4',
  },
  voteBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },
  fieldAuditBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#1f3d3c',
  },
  fieldAuditBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
});
