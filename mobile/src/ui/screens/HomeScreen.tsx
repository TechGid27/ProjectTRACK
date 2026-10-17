import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import MapHeader from '../components/MapHeader';
import CebuVectorMap from '../components/CebuVectorMap';
import LocationIntelSheet from '../components/LocationIntelSheet';
import ProjectDetailModal from '../components/ProjectDetailModal';
import ReportAnomalyModal from '../components/ReportAnomalyModal';
import AboutMapModal from '../components/AboutMapModal';
import ChatBotModal from '../components/ChatBotModal';
import MapFilterBar, { MapFilterOption } from '../components/MapFilterBar';
import FieldAuditorModal from '../components/FieldAuditorModal';
import { pins, initialPins } from '../../data/pins';
import {
  mockProjects,
  getProjectsByLocation,
  getProjectById,
} from '../../data/mockApi';
import { api } from '../../services/api';
import { FAQS } from '../../data/faqs';
import { Pin, ProjectDetail, AnomalyReport } from '../../core/types';
import { normalizeLguName } from '../../core/geoUtils';
import cebuDataRaw from '../../assets/cebuMunicipalities.json';

interface HomeScreenProps {
  currentUser?: { email: string } | null;
  onNavigateToSignIn: () => void;
  onNavigateToContractors?: () => void;
  onSignOut?: () => void;
}

// Extract and alphabetize all 53 Cebu Local Government Units
const ALL_LGU_NAMES: string[] = (
  cebuDataRaw?.features?.map((f: any) => normalizeLguName(f.properties?.name || '')) || []
).sort((a: string, b: string) => a.localeCompare(b));

export default function HomeScreen({
  currentUser,
  onNavigateToSignIn,
  onNavigateToContractors,
  onSignOut,
}: HomeScreenProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const mainScrollRef = useRef<ScrollView>(null);

  const [selectedLgu, setSelectedLgu] = useState<string | null>(null);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectDetail | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isChatBotOpen, setIsChatBotOpen] = useState(false);
  const [isAuditorModalOpen, setIsAuditorModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<MapFilterOption>('ALL');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [backendStats, setBackendStats] = useState({
    total_projects: mockProjects.length,
    total_lgus: 53,
    total_cities: 9,
    total_municipalities: 44,
  });

  useEffect(() => {
    let isMounted = true;
    api.fetchSummary().then((sum) => {
      if (isMounted) {
        setBackendStats({
          total_projects: sum.total_projects,
          total_lgus: sum.total_lgus,
          total_cities: 9,
          total_municipalities: 44,
        });
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // 1. Filter pins based on search query, selected LGU, and activeFilter
  const filteredPins = useMemo(() => {
    let result = initialPins || pins || [];
    if (selectedLgu) {
      const norm = normalizeLguName(selectedLgu).toLowerCase();
      result = result.filter(
        (p) => normalizeLguName(p.lgu).toLowerCase() === norm,
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.lgu.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)),
      );
    }
    if (activeFilter === 'DELAYED') {
      result = result.filter((p) => p.tone === 'warning');
    } else if (activeFilter === 'ONGOING') {
      result = result.filter((p) => p.tone !== 'warning');
    } else if (activeFilter === 'COMPLETED') {
      const completedIds = new Set(
        mockProjects.filter((m) => m.status === 'Completed').map((m) => m.id),
      );
      result = result.filter((p) => completedIds.has(p.id));
    } else if (activeFilter === 'HIGH_BUDGET') {
      const highBudgetIds = new Set(
        mockProjects.filter((m) => m.budget >= 50000000).map((m) => m.id),
      );
      result = result.filter((p) => highBudgetIds.has(p.id));
    }
    return result;
  }, [selectedLgu, searchQuery, activeFilter]);

  // 2. Filter projects for Location Intel sheet
  const activeProjects = useMemo(() => {
    if (selectedLgu) {
      return getProjectsByLocation(selectedLgu);
    }
    if (searchQuery.trim()) {
      return getProjectsByLocation(searchQuery);
    }
    return mockProjects;
  }, [selectedLgu, searchQuery]);

  // Handler: Selecting a municipality from map or search or LGU grid
  const handleSelectMunicipality = (name: string, shouldScrollToMap = false) => {
    const normalized = normalizeLguName(name);
    setSelectedLgu(normalized);
    setSelectedPinId(null);
    if (shouldScrollToMap) {
      mainScrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  // Handler: Selecting a glowing pin
  const handleSelectPin = (pin: Pin) => {
    setSelectedPinId(pin.id);
    setSelectedLgu(pin.lgu);

    // Try finding corresponding project detail
    const project = getProjectById(pin.id) || {
      id: pin.id,
      title: pin.name,
      contractor: 'Contractor on Record',
      budget: 25000000,
      status: pin.tone === 'warning' ? 'Delayed' : 'Ongoing',
      lgu: pin.lgu,
      scope: pin.description,
    };
    setSelectedProject(project);
    setIsDetailModalOpen(true);
  };

  // Handler: Selecting a project from the bottom sheet
  const handleSelectProjectCard = (project: ProjectDetail) => {
    setSelectedProject(project);
    setIsDetailModalOpen(true);
  };

  // Handler: Initiating Anomaly Report
  const handleReportAnomaly = (targetLgu: string) => {
    if (!selectedProject) {
      const fallback = activeProjects[0] || {
        id: `CIVIL-${normalizeLguName(targetLgu).toUpperCase()}`,
        title: `Public Infrastructure Site in ${targetLgu}`,
        contractor: 'Unknown / Under Investigation',
        budget: 0,
        status: 'Ongoing',
        lgu: targetLgu,
      };
      setSelectedProject(fallback);
    }
    setIsReportModalOpen(true);
  };

  // Handler: Anomaly Report from detail modal
  const handleReportFromDetail = (project: ProjectDetail) => {
    setSelectedProject(project);
    setIsDetailModalOpen(false);
    setIsReportModalOpen(true);
  };

  // Handler: Submitting report
  const handleSubmitReport = (report: AnomalyReport) => {
    setIsReportModalOpen(false);
    if (typeof alert !== 'undefined') {
      alert(`Report submitted successfully for Project ${report.projectId}!`);
    }
  };

  // Handler: Resetting selection back to province view
  const handleResetSelection = () => {
    setSelectedLgu(null);
    setSelectedPinId(null);
    setSearchQuery('');
  };

  const mapHeight = Math.max(280, (windowHeight || 600) * 0.46);
  const mapWidth = Math.max(300, windowWidth || 360);

  return (
    <View style={styles.container} testID="home-screen">
      {/* Top Floating App Header with Navigation */}
      <MapHeader
        totalLgus={53}
        totalPins={(initialPins || pins || []).length}
        currentUser={currentUser}
        onSearch={setSearchQuery}
        onSignInPress={onNavigateToSignIn}
        onNavigateToContractors={onNavigateToContractors}
        onNavigateToHome={handleResetSelection}
        onSignOut={onSignOut}
        onResetSelection={handleResetSelection}
      />

      {/* Floating Status & Budget Map Filter Pills */}
      <MapFilterBar
        activeFilter={activeFilter}
        onSelectFilter={setActiveFilter}
      />

      <ScrollView
        ref={mainScrollRef}
        style={styles.mainScrollView}
        contentContainerStyle={styles.mainScrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Interactive Vector Map of Cebu (Zoom, Pan, Touchable Municipality & Pins) */}
        <View style={styles.mapContainer}>
          <CebuVectorMap
            selectedMunicipality={selectedLgu}
            selectedPinId={selectedPinId}
            pins={filteredPins}
            onSelectMunicipality={handleSelectMunicipality}
            onSelectPin={handleSelectPin}
            width={mapWidth}
            height={mapHeight}
          />
        </View>

        {/* Section: Cebu, in text & Summary Stats */}
        <View style={styles.textSection}>
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={styles.actionBtnOutline}
              onPress={() => setIsAboutModalOpen(true)}
              activeOpacity={0.8}
              testID="open-about-map-btn"
            >
              <Text style={styles.actionBtnOutlineText}>About the map</Text>
            </TouchableOpacity>

            {onNavigateToContractors && (
              <TouchableOpacity
                style={styles.actionBtnSolid}
                onPress={onNavigateToContractors}
                activeOpacity={0.8}
                testID="home-view-contractors-btn"
              >
                <Text style={styles.actionBtnSolidText}>Contractor Rankings →</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.sectionTitle}>Cebu, in text</Text>
          <Text style={styles.sectionParagraph}>
            ProjectTRACK maps public works and infrastructure projects across
            Cebu Province. The map above is interactive — each glowing marker is
            a verified civil works project. The directory below presents the same
            records with direct municipal browsing.
          </Text>

          <View style={styles.statPillsContainer}>
            <View style={styles.statPill}>
              <Text style={styles.statPillText}>53 LGUs</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statPillText}>
                {mockProjects.length}+ projects tracked
              </Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statPillText}>9 cities</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statPillText}>44 municipalities</Text>
            </View>
          </View>

          {/* Section: Browse by Municipality */}
          <View style={styles.muniSection} testID="browse-by-municipality-section">
            <Text style={styles.muniTitle}>Browse by municipality</Text>
            <Text style={styles.muniSubtitle}>
              Tap an LGU to highlight it on the map and inspect projects.
            </Text>

            <View style={styles.muniGrid}>
              {ALL_LGU_NAMES.map((name) => {
                const isSelected =
                  Boolean(selectedLgu) &&
                  normalizeLguName(selectedLgu || '').toLowerCase() ===
                    name.toLowerCase();

                return (
                  <TouchableOpacity
                    key={name}
                    style={[
                      styles.muniChip,
                      isSelected && styles.muniChipSelected,
                    ]}
                    onPress={() => handleSelectMunicipality(name, true)}
                    activeOpacity={0.7}
                    testID={`muni-grid-btn-${name}`}
                  >
                    <Text
                      style={[
                        styles.muniChipText,
                        isSelected && styles.muniChipTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Section: Frequently Asked Questions */}
          <View style={styles.faqSection} testID="faqs-section">
            <Text style={styles.faqTitle}>Frequently asked questions</Text>

            <View style={styles.faqList}>
              {FAQS.map((faq, index) => {
                const isOpen = expandedFaq === index;
                return (
                  <View key={faq.q} style={styles.faqItem}>
                    <TouchableOpacity
                      style={styles.faqQuestionBtn}
                      onPress={() =>
                        setExpandedFaq(isOpen ? null : index)
                      }
                      activeOpacity={0.7}
                      testID={`faq-toggle-btn-${index}`}
                    >
                      <Text style={styles.faqQuestionText}>{faq.q}</Text>
                      <Text style={styles.faqToggleIcon}>
                        {isOpen ? '▲' : '▼'}
                      </Text>
                    </TouchableOpacity>

                    {isOpen && (
                      <View style={styles.faqAnswerBox}>
                        <Text style={styles.faqAnswerText}>{faq.a}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* Bottom Spacer for Drawer & Floating Chat Button */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Floating Civic Assistant Button */}
      <TouchableOpacity
        style={styles.floatingChatBtn}
        onPress={() => setIsChatBotOpen(true)}
        activeOpacity={0.8}
        testID="open-chat-bot-btn"
        accessibilityLabel="Open Civic AI Assistant"
      >
        <Text style={styles.floatingChatIcon}>💬</Text>
        <Text style={styles.floatingChatText}>Ask AI</Text>
      </TouchableOpacity>

      {/* Bottom Location Intel Sheet */}
      <LocationIntelSheet
        lguName={selectedLgu || 'Cebu Province'}
        projects={activeProjects}
        onSelectProject={handleSelectProjectCard}
        onReportAnomaly={handleReportAnomaly}
        onFieldAuditPress={(proj) => {
          setSelectedProject(proj);
          setIsAuditorModalOpen(true);
        }}
        onClose={handleResetSelection}
      />

      {/* Field Auditor Shutter Modal */}
      <FieldAuditorModal
        visible={isAuditorModalOpen}
        project={selectedProject}
        onClose={() => setIsAuditorModalOpen(false)}
      />

      {/* About Map Modal */}
      <AboutMapModal
        visible={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
      />

      {/* Civic AI ChatBot Modal */}
      <ChatBotModal
        visible={isChatBotOpen}
        onClose={() => setIsChatBotOpen(false)}
      />

      {/* Project Detail Modal */}
      <ProjectDetailModal
        visible={isDetailModalOpen}
        project={selectedProject}
        onClose={() => setIsDetailModalOpen(false)}
        onReportAnomaly={handleReportFromDetail}
      />

      {/* Report Anomaly Modal */}
      <ReportAnomalyModal
        visible={isReportModalOpen}
        project={selectedProject}
        onClose={() => setIsReportModalOpen(false)}
        onSubmit={handleSubmitReport}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#cbe3df', // Water background
    position: 'relative',
    height: '100%',
    width: '100%',
  },
  mainScrollView: {
    flex: 1,
  },
  mainScrollContent: {
    flexGrow: 1,
  },
  mapContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#cbe3df',
  },
  textSection: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    marginTop: -10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  actionBtnOutline: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f3d3c',
    backgroundColor: 'transparent',
  },
  actionBtnOutlineText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1f3d3c',
  },
  actionBtnSolid: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#1f3d3c',
  },
  actionBtnSolidText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  sectionParagraph: {
    fontSize: 13,
    lineHeight: 20,
    color: '#475569',
    marginBottom: 14,
  },
  statPillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  statPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  muniSection: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 20,
    marginBottom: 24,
  },
  muniTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  muniSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 14,
  },
  muniGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  muniChip: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  muniChipSelected: {
    backgroundColor: '#1f3d3c',
    borderColor: '#1f3d3c',
  },
  muniChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  muniChipTextSelected: {
    color: '#ffffff',
  },
  faqSection: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 20,
    marginBottom: 24,
  },
  faqTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 14,
  },
  faqList: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  faqQuestionBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff',
  },
  faqQuestionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
    marginRight: 10,
  },
  faqToggleIcon: {
    fontSize: 11,
    color: '#94a3b8',
  },
  faqAnswerBox: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    backgroundColor: '#f8fafc',
  },
  faqAnswerText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#475569',
  },
  bottomSpacer: {
    height: 180,
  },
  floatingChatBtn: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    backgroundColor: '#1f3d3c',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 99,
  },
  floatingChatIcon: {
    fontSize: 16,
  },
  floatingChatText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
});
