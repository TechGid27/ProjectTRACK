import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
import MapHeader from '../components/MapHeader';
import UnifiedCebuMap, { UnifiedCebuMapRef } from '../components/UnifiedCebuMap';
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
import { Pin, ProjectDetail, AnomalyReport, ProjectStatus } from '../../core/types';
import { normalizeLguName, normalizeCoordinates } from '../../core/geoUtils';
import cebuDataRaw from '../../assets/cebuMunicipalities.json';

interface MapScreenProps {
  currentUser?: { email: string } | null;
  onNavigateToSignIn: () => void;
  onNavigateToContractors: () => void;
  onSignOut?: () => void;
  initialLgu?: string | null;
  initialProjectId?: string | null;
  initialSheetState?: SheetDisplayState;
}

export default function MapScreen({
  currentUser,
  onNavigateToSignIn,
  onNavigateToContractors,
  onSignOut,
  initialLgu = null,
  initialProjectId = null,
  initialSheetState = 'hidden',
}: MapScreenProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const mapRef = useRef<UnifiedCebuMapRef>(null);

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
  const [sheetState, setSheetState] = useState<SheetDisplayState>(initialSheetState);
  const [mapPins, setMapPins] = useState<Pin[]>(initialPins || pins || []);
  const [activeProjects, setActiveProjects] = useState<ProjectDetail[]>(
    initialLgu ? getProjectsByLocation(initialLgu) : mockProjects,
  );

  useEffect(() => {
    if (initialLgu) {
      setSelectedLgu(normalizeLguName(initialLgu));
      if (initialSheetState === 'expanded') {
        setSheetState('expanded');
      }
    }
  }, [initialLgu]);

  useEffect(() => {
    if (initialProjectId) {
      handleSelectProjectById(initialProjectId);
    }
  }, [initialProjectId]);

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
      .fetchProjectsByLocation(loc, 100)
      .then((projects) => {
        if (isMounted && projects && projects.length > 0) {
          setActiveProjects(projects);

          setMapPins((prevPins) => {
            const pinMap = new Map<string, Pin>();
            prevPins.forEach((p) => pinMap.set(p.id, p));

            projects.forEach((proj) => {
              const existing = pinMap.get(proj.id);
              const rawLat = typeof proj.latitude === 'number' ? proj.latitude : (existing?.lat ?? 10.3115);
              const rawLng = typeof proj.longitude === 'number' ? proj.longitude : (existing?.lng ?? 123.9534);
              const normalized = normalizeCoordinates(rawLat, rawLng);
              const lat = normalized.status !== 'rejected' ? normalized.lat : (existing?.lat ?? 10.3115);
              const lng = normalized.status !== 'rejected' ? normalized.lng : (existing?.lng ?? 123.9534);

              pinMap.set(proj.id, {
                id: proj.id,
                name: proj.title,
                lat,
                lng,
                tone: proj.status === 'Delayed' ? 'warning' : 'default',
                lgu: proj.lgu,
                description: proj.scope || proj.title,
                budget: proj.budget,
                status: proj.status,
                contractor: proj.contractor,
                report_count: proj.report_count || 0,
                is_hotspot: proj.is_hotspot || false,
              });
            });

            return Array.from(pinMap.values());
          });
        }
      })
      .catch(() => {});

    api
      .fetchMapPins(loc)
      .then((muniPins) => {
        if (isMounted && muniPins && muniPins.length > 0) {
          setMapPins((prevPins) => {
            const pinMap = new Map<string, Pin>();
            prevPins.forEach((p) => pinMap.set(p.id, p));
            muniPins.forEach((p) => pinMap.set(p.id, p));
            return Array.from(pinMap.values());
          });
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [selectedLgu, searchQuery]);

  // Dynamic LGU-specific projects for LocationIntelSheet
  const currentLguProjects = useMemo(() => {
    if (!selectedLgu) return activeProjects;
    const targetNorm = normalizeLguName(selectedLgu).toLowerCase();

    const filteredActive = activeProjects.filter(
      (p) => normalizeLguName(p.lgu).toLowerCase() === targetNorm,
    );
    if (filteredActive.length > 0) return filteredActive;

    const matchingPins = mapPins.filter(
      (p) => normalizeLguName(p.lgu).toLowerCase() === targetNorm,
    );
    if (matchingPins.length > 0) {
      return matchingPins.map((p) => ({
        id: p.id,
        title: p.name,
        contractor: p.contractor || 'Contractor on Record',
        budget: typeof p.budget === 'number' ? p.budget : 28500000,
        status: (p.status === 'Completed'
          ? 'Completed'
          : p.tone === 'warning' || p.status === 'Delayed'
          ? 'Delayed'
          : 'Ongoing') as ProjectStatus,
        lgu: p.lgu,
        scope: p.description,
        report_count: p.report_count || 0,
        is_hotspot: p.is_hotspot || false,
      }));
    }

    return getProjectsByLocation(selectedLgu);
  }, [selectedLgu, activeProjects, mapPins]);

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

  const handleReportAnomaly = (_targetLgu?: string) => {
    setSelectedProject(null);
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

  const mapHeight = useMemo(() => {
    const screenH = windowHeight || 640;
    if (sheetState === 'hidden') {
      return Math.max(500, screenH - 100);
    }
    if (sheetState === 'minimized') {
      return Math.max(420, screenH - 160);
    }
    return Math.max(340, screenH * 0.55);
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

      {/* Full Viewport Interactive Map (Hardware Vector on Mobile, SVG Vector on Web) */}
      <View style={styles.mapContainer}>
        <UnifiedCebuMap
          ref={mapRef}
          testID="unified-cebu-map"
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
            {selectedLgu ? `Details: ${selectedLgu}` : 'Show Details'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Bottom Location Intel Sheet (Expanded, Minimized, or Hidden) */}
      <LocationIntelSheet
        lguName={selectedLgu || 'Cebu Province'}
        projects={currentLguProjects}
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
        onSelectProject={(projectId) => {
          handleSelectProjectById(projectId);
          const proj = activeProjects.find((p) => p.id === projectId);
          if (proj && typeof proj.latitude === 'number' && typeof proj.longitude === 'number') {
            mapRef.current?.animateToCoordinates(proj.latitude, proj.longitude, 15);
            setIsChatBotOpen(false); // auto-minimize AI chat on spatial query
          }
        }}
        onFocusLgu={(lgu) => {
          handleSelectMunicipality(lgu);
          setIsChatBotOpen(false);
          const norm = normalizeLguName(lgu).toLowerCase();
          const feat = cebuDataRaw?.features?.find(
            (f: any) => normalizeLguName(f.properties?.name || '').toLowerCase() === norm,
          );
          if (feat) {
            const label = (feat as any).properties?.label;
            if (Array.isArray(label) && label.length === 2) {
              mapRef.current?.animateToCoordinates(label[1], label[0], 12.5);
            }
          }
        }}
        currentLgu={selectedLgu}
        activeProjects={activeProjects}
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
        availableProjects={currentLguProjects}
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
    bottom: 76,
    right: 16,
    backgroundColor: '#1f3d3c',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 90,
  },
  floatingChatIcon: {
    fontSize: 15,
  },
  floatingChatText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  floatingAboutBtn: {
    position: 'absolute',
    bottom: 76,
    left: 16,
    backgroundColor: 'rgba(31, 61, 60, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
    zIndex: 90,
  },
  floatingAboutText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  floatingShowSheetPill: {
    position: 'absolute',
    bottom: 16,
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
    maxWidth: '90%',
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
    zIndex: 90,
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
