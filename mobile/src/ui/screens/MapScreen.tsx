import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
import MapHeader from '../components/MapHeader';
import CebuVectorMap from '../components/CebuVectorMap';
import LocationIntelSheet, { SheetDisplayState } from '../components/LocationIntelSheet';
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
import { Pin, ProjectDetail, AnomalyReport } from '../../core/types';
import { normalizeLguName } from '../../core/geoUtils';

interface MapScreenProps {
  currentUser?: { email: string } | null;
  onNavigateToSignIn: () => void;
  onNavigateToContractors: () => void;
  onSignOut?: () => void;
  initialLgu?: string | null;
}

export default function MapScreen({
  currentUser,
  onNavigateToSignIn,
  onNavigateToContractors,
  onSignOut,
  initialLgu = null,
}: MapScreenProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const [selectedLgu, setSelectedLgu] = useState<string | null>(initialLgu);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectDetail | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isChatBotOpen, setIsChatBotOpen] = useState(false);
  const [isAuditorModalOpen, setIsAuditorModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<MapFilterOption>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sheetState, setSheetState] = useState<SheetDisplayState>('expanded');
  const [mapPins, setMapPins] = useState<Pin[]>(initialPins || pins || []);
  const [activeProjects, setActiveProjects] = useState<ProjectDetail[]>(
    initialLgu ? getProjectsByLocation(initialLgu) : mockProjects,
  );

  useEffect(() => {
    if (initialLgu) {
      setSelectedLgu(normalizeLguName(initialLgu));
      setSheetState('expanded');
    }
  }, [initialLgu]);

  // Fetch live map pins on mount
  useEffect(() => {
    let isMounted = true;
    api
      .fetchMapPins()
      .then((livePins) => {
        if (isMounted && livePins && livePins.length > 0) {
          setMapPins(livePins);
        }
      })
      .catch(() => {
        // Retain initial pins
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch live projects by location whenever selectedLgu or searchQuery changes
  useEffect(() => {
    const loc = selectedLgu || searchQuery.trim();
    if (!loc) {
      setActiveProjects(mockProjects);
      return;
    }
    let isMounted = true;
    api
      .fetchProjectsByLocation(loc, 30)
      .then((projects) => {
        if (isMounted && projects && projects.length > 0) {
          setActiveProjects(projects);
        }
      })
      .catch(() => {
        // Retain current projects
      });
    return () => {
      isMounted = false;
    };
  }, [selectedLgu, searchQuery]);

  // 1. Filter pins based on search query, selected LGU, and activeFilter
  const filteredPins = useMemo(() => {
    let result = mapPins;
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
  }, [mapPins, selectedLgu, searchQuery, activeFilter]);

  const handleSelectMunicipality = (name: string) => {
    const normalized = normalizeLguName(name);
    setSelectedLgu(normalized);
    setSelectedPinId(null);
    if (sheetState === 'hidden') {
      setSheetState('expanded');
    }
  };

  const handleSelectPin = (pin: Pin) => {
    setSelectedPinId(pin.id);
    setSelectedLgu(pin.lgu);
    if (sheetState === 'hidden') {
      setSheetState('expanded');
    }

    const optimisticProject: ProjectDetail = getProjectById(pin.id) || {
      id: pin.id,
      title: pin.name,
      contractor: 'Contractor on Record',
      budget: 25000000,
      status: pin.tone === 'warning' ? 'Delayed' : 'Ongoing',
      lgu: pin.lgu,
      scope: pin.description,
    };
    setSelectedProject(optimisticProject);
    setIsDetailModalOpen(true);

    api.fetchProjectById(pin.id).then((live) => {
      if (live) {
        setSelectedProject(live);
      }
    });
  };

  const handleSelectProjectCard = (project: ProjectDetail) => {
    setSelectedProject(project);
    setIsDetailModalOpen(true);
  };

  const handleSelectProjectById = (projectId: string) => {
    const optimistic = getProjectById(projectId);
    if (optimistic) {
      setSelectedProject(optimistic);
      setIsDetailModalOpen(true);
    }
    api.fetchProjectById(projectId).then((p) => {
      if (p) {
        setSelectedProject(p);
        setIsDetailModalOpen(true);
      }
    });
  };

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

  const handleReportFromDetail = (project: ProjectDetail) => {
    setSelectedProject(project);
    setIsDetailModalOpen(false);
    setIsReportModalOpen(true);
  };

  const handleSubmitReport = (report: AnomalyReport) => {
    setIsReportModalOpen(false);
    if (typeof alert !== 'undefined') {
      alert(`Report submitted successfully for Project ${report.projectId}!`);
    }
  };

  const handleResetSelection = () => {
    setSelectedLgu(null);
    setSelectedPinId(null);
    setSearchQuery('');
  };

  // Dynamic Map Dimensions depending on sheet display state
  const mapHeight = useMemo(() => {
    const screenH = windowHeight || 640;
    if (sheetState === 'hidden') {
      return Math.max(450, screenH - 160);
    }
    if (sheetState === 'minimized') {
      return Math.max(380, screenH - 225);
    }
    return Math.max(280, screenH * 0.48);
  }, [windowHeight, sheetState]);

  const mapWidth = Math.max(320, windowWidth || 360);

  return (
    <View style={styles.container} testID="map-screen">
      {/* Top Floating App Header with Navigation */}
      <MapHeader
        totalLgus={53}
        totalPins={mapPins.length}
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

      {/* Full Viewport Interactive Vector Map (Expands dynamically) */}
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

      {/* Floating "About Map" quick badge */}
      <TouchableOpacity
        style={styles.floatingAboutBtn}
        onPress={() => setIsAboutModalOpen(true)}
        activeOpacity={0.8}
        testID="open-about-map-btn"
        accessibilityLabel="About the Map"
      >
        <Text style={styles.floatingAboutText}>ℹ️ Info</Text>
      </TouchableOpacity>

      {/* Floating "Show Details" Pill when sheet is hidden */}
      {sheetState === 'hidden' && (
        <TouchableOpacity
          style={styles.floatingShowSheetPill}
          onPress={() => setSheetState('expanded')}
          activeOpacity={0.85}
          testID="sheet-show-pill-btn"
          accessibilityLabel="Show location details sheet"
        >
          <Text style={styles.floatingShowSheetIcon}>📊</Text>
          <Text style={styles.floatingShowSheetText}>
            {selectedLgu ? `Details: ${selectedLgu}` : `Show Details (${activeProjects.length} Projects)`}
          </Text>
        </TouchableOpacity>
      )}

      {/* Bottom Location Intel Sheet (Expanded, Minimized, or Hidden) */}
      <LocationIntelSheet
        lguName={selectedLgu || 'Cebu Province'}
        projects={activeProjects}
        sheetState={sheetState}
        onStateChange={setSheetState}
        onSelectProject={handleSelectProjectCard}
        onReportAnomaly={handleReportAnomaly}
        onFieldAuditPress={(proj) => {
          setSelectedProject(proj);
          setIsAuditorModalOpen(true);
        }}
        onClose={() => {
          setSheetState('hidden');
          handleResetSelection();
        }}
      />

      {/* Modals */}
      <FieldAuditorModal
        visible={isAuditorModalOpen}
        project={selectedProject}
        onClose={() => setIsAuditorModalOpen(false)}
      />

      <AboutMapModal
        visible={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
      />

      <ChatBotModal
        visible={isChatBotOpen}
        onClose={() => setIsChatBotOpen(false)}
        onSelectProject={handleSelectProjectById}
        onFocusLgu={handleSelectMunicipality}
      />

      <ProjectDetailModal
        visible={isDetailModalOpen}
        project={selectedProject}
        onClose={() => setIsDetailModalOpen(false)}
        onReportAnomaly={handleReportFromDetail}
      />

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
    backgroundColor: '#cbe3df',
    position: 'relative',
    height: '100%',
    width: '100%',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#cbe3df',
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
  floatingAboutBtn: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    backgroundColor: 'rgba(31, 61, 60, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
    zIndex: 99,
  },
  floatingAboutText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  floatingShowSheetPill: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: '#162e2d',
    borderWidth: 1.5,
    borderColor: '#34d399',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 24,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
        elevation: 10,
      },
    }),
    zIndex: 95,
  },
  floatingShowSheetIcon: {
    fontSize: 16,
  },
  floatingShowSheetText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
});
