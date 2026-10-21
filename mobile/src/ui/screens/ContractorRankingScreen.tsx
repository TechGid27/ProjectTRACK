import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Contractor, ProjectDetail } from '../../core/types';
import { mockProjects } from '../../data/mockApi';
import { formatCurrencyPHP } from '../../core/geoUtils';
import { topContractors } from '../../data/contractors';
import { api } from '../../services/api';

const PAGE_SIZE = 6;
const MEDALS = ['🥇', '🥈', '🥉'];

interface ContractorRankingScreenProps {
  onBackToMap: () => void;
  onNavigateToProjectOnMap?: (lgu: string, projectId: string) => void;
}

export default function ContractorRankingScreen({
  onBackToMap,
  onNavigateToProjectOnMap,
}: ContractorRankingScreenProps) {
  const [selectedContractor, setSelectedContractor] = useState<Contractor | null>(null);
  const [contractorProjects, setContractorProjects] = useState<ProjectDetail[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const handleContractorPress = (contractor: Contractor) => {
    setSelectedContractor(contractor);
    setLoadingProjects(true);
    api.searchProjects(contractor.contractor, 30)
      .then((res) => {
        if (res && res.length > 0) {
          setContractorProjects(res);
        } else {
          const cleanName = contractor.contractor.toLowerCase();
          const fallback = mockProjects.filter((p) => p.contractor.toLowerCase().includes(cleanName));
          setContractorProjects(fallback);
        }
      })
      .catch(() => {
        const cleanName = contractor.contractor.toLowerCase();
        const fallback = mockProjects.filter((p) => p.contractor.toLowerCase().includes(cleanName));
        setContractorProjects(fallback);
      })
      .finally(() => {
        setLoadingProjects(false);
      });
  };
  const [contractors, setContractors] = useState<Contractor[]>(topContractors);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    api
      .fetchTopContractors(50)
      .then((items) => {
        if (isMounted && items && items.length > 0) {
          setContractors(items);
        }
      })
      .catch(() => {
        // Fall back gracefully to offline dataset
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Filter contractors based on query
  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return contractors;
    return contractors.filter(
      (c) =>
        c.contractor.toLowerCase().includes(q) ||
        (c.code && c.code.toLowerCase().includes(q)),
    );
  }, [contractors, searchQuery]);

  const maxBudget = useMemo(() => {
    return contractors[0]?.total_budget || 1;
  }, [contractors]);

  const pageCount = Math.max(1, Math.ceil(filteredList.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pagedItems = filteredList.slice(
    safePage * PAGE_SIZE,
    (safePage + 1) * PAGE_SIZE,
  );

  const getRankBadgeStyle = (rank: number) => {
    if (rank === 1) return { bg: '#fef3c7', text: '#d97706', border: '#fde68a' };
    if (rank === 2) return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
    if (rank === 3) return { bg: '#ffedd5', text: '#ea580c', border: '#fed7aa' };
    return { bg: '#e6fffa', text: '#0d9488', border: '#99f6e4' };
  };

  return (
    <SafeAreaView style={styles.safeArea} testID="contractor-ranking-screen">
      <View style={styles.container}>
        {/* Navigation & Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onBackToMap}
            activeOpacity={0.7}
            testID="back-to-map-btn"
          >
            <Text style={styles.backBtnText}>← Back to Map</Text>
          </TouchableOpacity>

          <Text style={styles.eyebrow}>DPWH CEBU</Text>
          <Text style={styles.title}>Contractor Ranking</Text>
          <Text style={styles.subtitle}>
            Infrastructure firms ranked by total awarded budget across tracked DPWH
            Cebu civil works. Codes are DPWH registration numbers.
          </Text>
          {loading && (
            <ActivityIndicator
              size="small"
              color="#0d9488"
              style={{ marginTop: 6 }}
              testID="contractor-ranking-loader"
            />
          )}

          {/* Search Box */}
          <View style={styles.searchRow}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search contractor name or #code..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                setPage(0);
              }}
              autoCapitalize="none"
              testID="contractor-search-input"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setPage(0);
                }}
              >
                <Text style={styles.clearBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* List of Contractors */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {pagedItems.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No contractors found</Text>
              <Text style={styles.emptyText}>
                No contractor matches &quot;{searchQuery}&quot;.
              </Text>
            </View>
          ) : (
            pagedItems.map((contractor: Contractor, i: number) => {
              const rank = safePage * PAGE_SIZE + i + 1;
              const badgeStyle = getRankBadgeStyle(rank);
              const pct = Math.max(
                4,
                Math.round((contractor.total_budget / maxBudget) * 100),
              );

              return (
                <TouchableOpacity
                  onPress={() => handleContractorPress(contractor)}
                  activeOpacity={0.8}
                  key={`${contractor.code || 'c'}-${contractor.contractor}`}
                  style={styles.card}
                  testID={`contractor-card-${rank}`}
                >
                  <View style={styles.cardTop}>
                    {/* Rank Badge */}
                    <View
                      style={[
                        styles.rankBadge,
                        {
                          backgroundColor: badgeStyle.bg,
                          borderColor: badgeStyle.border,
                        },
                      ]}
                    >
                      <Text
                        style={[styles.rankBadgeText, { color: badgeStyle.text }]}
                      >
                        {rank <= 3 ? MEDALS[rank - 1] : rank}
                      </Text>
                    </View>

                    {/* Contractor Info */}
                    <View style={styles.infoCol}>
                      <View style={styles.nameRow}>
                        <Text style={styles.contractorName} numberOfLines={2}>
                          {contractor.contractor}
                        </Text>
                      </View>

                      {contractor.code && (
                        <View style={styles.codeBadge}>
                          <Text style={styles.codeBadgeText}>
                            #{contractor.code}
                          </Text>
                        </View>
                      )}

                      <View style={styles.statsRow}>
                        <Text style={styles.budgetText}>
                          {formatCurrencyPHP(contractor.total_budget)}
                        </Text>
                        <Text style={styles.dotSeparator}>·</Text>
                        <Text style={styles.projectsCountText}>
                          {contractor.project_count} projects
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Budget Share Progress Bar */}
                  <View style={styles.progressTrack}>
                    <View
                      style={[styles.progressFill, { width: `${pct}%` }]}
                    />
                  </View>
                </TouchableOpacity>
              );
            })
          )}

          {/* Pagination Controls */}
          {filteredList.length > 0 && (
            <View style={styles.paginationRow}>
              <Text style={styles.paginationText}>
                Showing {safePage * PAGE_SIZE + 1}–
                {Math.min((safePage + 1) * PAGE_SIZE, filteredList.length)} of{' '}
                {filteredList.length}
              </Text>

              <View style={styles.pageButtonsGroup}>
                <TouchableOpacity
                  style={[
                    styles.pageBtn,
                    safePage === 0 && styles.pageBtnDisabled,
                  ]}
                  onPress={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                  testID="prev-page-btn"
                >
                  <Text
                    style={[
                      styles.pageBtnText,
                      safePage === 0 && styles.pageBtnTextDisabled,
                    ]}
                  >
                    Previous
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.pageBtn,
                    safePage >= pageCount - 1 && styles.pageBtnDisabled,
                  ]}
                  onPress={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={safePage >= pageCount - 1}
                  testID="next-page-btn"
                >
                  <Text
                    style={[
                      styles.pageBtnText,
                      safePage >= pageCount - 1 && styles.pageBtnTextDisabled,
                    ]}
                  >
                    Next
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Contractor Projects Drilldown Modal */}
        <Modal
          visible={selectedContractor !== null}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setSelectedContractor(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle} numberOfLines={1}>
                    {selectedContractor?.contractor}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    {selectedContractor?.project_count} projects · {selectedContractor && formatCurrencyPHP(selectedContractor.total_budget)}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSelectedContractor(null)}
                  style={styles.modalCloseBtn}
                  testID="close-contractor-modal-btn"
                >
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              {loadingProjects ? (
                <View style={styles.modalLoading}>
                  <ActivityIndicator size="large" color="#0d9488" />
                  <Text style={styles.loadingText}>Loading contractor projects…</Text>
                </View>
              ) : (
                <ScrollView style={styles.modalScroll}>
                  {contractorProjects.length === 0 ? (
                    <Text style={styles.emptyProjectsText}>No project records found.</Text>
                  ) : (
                    contractorProjects.map((proj) => (
                      <View key={proj.id} style={styles.projItem}>
                        <View style={styles.projTopRow}>
                          <Text style={styles.projIdBadge}>{proj.id}</Text>
                          <Text style={styles.projLguBadge}>{proj.lgu}</Text>
                        </View>
                        <Text style={styles.projTitle} numberOfLines={2}>
                          {proj.title}
                        </Text>
                        <View style={styles.projFooter}>
                          <Text style={styles.projBudget}>
                            {formatCurrencyPHP(proj.budget)}
                          </Text>
                          <TouchableOpacity
                            style={styles.viewOnMapBtn}
                            onPress={() => {
                              setSelectedContractor(null);
                              onNavigateToProjectOnMap?.(proj.lgu, proj.id);
                            }}
                            testID={`view-on-map-${proj.id}`}
                          >
                            <Text style={styles.viewOnMapText}>📍 View on Map →</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  )}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
    height: '100%',
    width: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    marginBottom: 12,
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1f3d3c',
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#0d9488',
    marginBottom: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 14,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 38,
  },
  searchIcon: {
    fontSize: 13,
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    paddingVertical: 0,
  },
  clearBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankBadgeText: {
    fontSize: 15,
    fontWeight: '900',
  },
  infoCol: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  contractorName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 20,
  },
  codeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
    marginBottom: 6,
  },
  codeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  budgetText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0d9488',
  },
  dotSeparator: {
    color: '#94a3b8',
    fontSize: 14,
  },
  projectsCountText: {
    fontSize: 12,
    color: '#64748b',
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1f3d3c',
    borderRadius: 3,
  },
  emptyBox: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  paginationText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  pageButtonsGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  pageBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1f3d3c',
  },
  pageBtnTextDisabled: {
    color: '#94a3b8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#0d9488',
    fontWeight: '700',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '700',
  },
  modalLoading: {
    paddingVertical: 36,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
  },
  modalScroll: {
    maxHeight: 400,
  },
  emptyProjectsText: {
    textAlign: 'center',
    paddingVertical: 24,
    color: '#94a3b8',
    fontSize: 13,
  },
  projItem: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  projTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  projIdBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0d9488',
    backgroundColor: '#ccfbf1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  projLguBadge: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  projTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
    lineHeight: 18,
    marginBottom: 8,
  },
  projFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  projBudget: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  viewOnMapBtn: {
    backgroundColor: '#1f3d3c',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  viewOnMapText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
});
