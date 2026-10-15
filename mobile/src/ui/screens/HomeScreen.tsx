import React, { useState, useMemo } from 'react';
import { View, StyleSheet, Alert, Dimensions } from 'react-native';
import MapHeader from '../components/MapHeader';
import CebuVectorMap from '../components/CebuVectorMap';
import LocationIntelSheet from '../components/LocationIntelSheet';
import ProjectDetailModal from '../components/ProjectDetailModal';
import ReportAnomalyModal from '../components/ReportAnomalyModal';
import { initialPins } from '../../data/pins';
import {
  mockProjects,
  getProjectsByLocation,
  getProjectById,
} from '../../data/mockApi';
import { Pin, ProjectDetail, AnomalyReport } from '../../core/types';
import { normalizeLguName } from '../../core/geoUtils';

interface HomeScreenProps {
  onNavigateToSignIn: () => void;
}

export default function HomeScreen({ onNavigateToSignIn }: HomeScreenProps) {
  const [selectedLgu, setSelectedLgu] = useState<string | null>(null);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectDetail | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Filter pins based on search query or selected LGU
  const filteredPins = useMemo(() => {
    let result = initialPins;
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
    return result;
  }, [selectedLgu, searchQuery]);

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

  // Handler: Selecting a municipality from map or search
  const handleSelectMunicipality = (name: string) => {
    const normalized = normalizeLguName(name);
    setSelectedLgu(normalized);
    setSelectedPinId(null);
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
      // Pick first project from current active list or construct fallback
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
    // Show citizen confirmation
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

  const mapHeight = Dimensions.get('window').height * 0.52;

  return (
    <View style={styles.container}>
      {/* Top Floating App Header with Search */}
      <MapHeader
        totalLgus={53}
        totalPins={initialPins.length}
        onSearch={setSearchQuery}
        onSignInPress={onNavigateToSignIn}
        onResetSelection={handleResetSelection}
      />

      {/* Interactive Vector Map of Cebu */}
      <View style={styles.mapContainer}>
        <CebuVectorMap
          selectedMunicipality={selectedLgu}
          selectedPinId={selectedPinId}
          pins={filteredPins}
          onSelectMunicipality={handleSelectMunicipality}
          onSelectPin={handleSelectPin}
          height={mapHeight}
        />
      </View>

      {/* Bottom Location Intel Sheet */}
      <LocationIntelSheet
        lguName={selectedLgu || 'Cebu Province'}
        projects={activeProjects}
        onSelectProject={handleSelectProjectCard}
        onReportAnomaly={handleReportAnomaly}
        onClose={handleResetSelection}
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
  },
  mapContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
