import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import MapScreen from '../src/ui/screens/MapScreen';
import { api } from '../src/services/api';
import { Pin, ProjectDetail } from '../src/core/types';

const MOCK_PINS: Pin[] = [
  {
    id: '24HD0012',
    name: 'Flood Mitigation Structure along Bogo River',
    lat: 11.054,
    lng: 124.006,
    tone: 'default',
    lgu: 'Bogo City',
    description: 'Bogo River flood control.',
    budget: 49000000,
    status: 'Ongoing',
    contractor: 'QM BUILDERS',
  },
];

const MOCK_PROJECT: ProjectDetail = {
  id: '24HD0012',
  title: 'Flood Mitigation Structure along Bogo River',
  contractor: 'QM BUILDERS',
  budget: 49000000,
  status: 'Ongoing',
  lgu: 'Bogo City',
  latitude: 11.054,
  longitude: 124.006,
};

describe('MapScreen Component', () => {
  const mockOnNavigateToSignIn = jest.fn();
  const mockOnNavigateToContractors = jest.fn();
  const mockOnSignOut = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(api, 'fetchMapPins').mockResolvedValue(MOCK_PINS);
    jest.spyOn(api, 'fetchProjectsByLocation').mockResolvedValue([MOCK_PROJECT]);
    jest.spyOn(api, 'fetchProjectById').mockResolvedValue(MOCK_PROJECT);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('renders MapHeader, Map View, and Show Details pill when sheet is initially closed', () => {
    const { getByTestId } = render(
      <MapScreen
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
        onSignOut={mockOnSignOut}
      />,
    );

    expect(getByTestId('map-screen')).toBeTruthy();
    expect(getByTestId('unified-cebu-map')).toBeTruthy();
    expect(getByTestId('map-header')).toBeTruthy();
    expect(getByTestId('map-filter-bar')).toBeTruthy();
    expect(getByTestId('map-refresh-btn')).toBeTruthy();
    expect(getByTestId('sheet-show-pill-btn')).toBeTruthy();
    expect(getByTestId('open-chat-bot-btn')).toBeTruthy();
    expect(getByTestId('open-about-map-btn')).toBeTruthy();
  });

  test('filtering projects using map status filter bar', () => {
    const { getByTestId } = render(
      <MapScreen
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
        onSignOut={mockOnSignOut}
      />,
    );

    const ongoingFilterBtn = getByTestId('filter-btn-ongoing');
    expect(ongoingFilterBtn).toBeTruthy();
    fireEvent.press(ongoingFilterBtn);

    const delayedFilterBtn = getByTestId('filter-btn-delayed');
    expect(delayedFilterBtn).toBeTruthy();
    fireEvent.press(delayedFilterBtn);
  });

  test('toggling region focus presets expands the carousel and allows selecting a region', () => {
    const { getByTestId, queryByTestId } = render(
      <MapScreen
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
        onSignOut={mockOnSignOut}
      />,
    );

    expect(queryByTestId('region-presets-carousel')).toBeNull();

    const toggleBtn = getByTestId('region-quick-jump-toggle-btn');
    fireEvent.press(toggleBtn);

    expect(getByTestId('region-presets-carousel')).toBeTruthy();

    const bantayanPreset = getByTestId('region-preset-bantayan');
    expect(bantayanPreset).toBeTruthy();
    fireEvent.press(bantayanPreset);
  });

  test('minimizing the sheet renders the compact peek bar and gives more room to the map', () => {
    const { getByTestId, queryByText } = render(
      <MapScreen
        initialSheetState="expanded"
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
        onSignOut={mockOnSignOut}
      />,
    );

    // Initially expanded when initialSheetState="expanded"
    expect(getByTestId('location-intel-sheet')).toBeTruthy();

    // Minimize it
    const minimizeBtn = getByTestId('sheet-minimize-btn');
    fireEvent.press(minimizeBtn);

    // Minimized bar should now be visible
    expect(getByTestId('location-intel-sheet-minimized')).toBeTruthy();

    // Detailed project list should not be visible
    expect(queryByText('Flood Mitigation Structure along Bogo River')).toBeNull();
  });

  test('hiding the sheet completely reveals the floating show pill', () => {
    const { getByTestId, queryByTestId } = render(
      <MapScreen
        initialSheetState="expanded"
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
        onSignOut={mockOnSignOut}
      />,
    );

    // Close / hide the sheet
    const closeBtn = getByTestId('sheet-close-btn');
    fireEvent.press(closeBtn);

    // Both expanded and minimized sheets are gone
    expect(queryByTestId('location-intel-sheet')).toBeNull();
    expect(queryByTestId('location-intel-sheet-minimized')).toBeNull();

    // Floating show button is visible
    const showPill = getByTestId('sheet-show-pill-btn');
    expect(showPill).toBeTruthy();

    // Tapping the floating show pill restores the sheet
    fireEvent.press(showPill);
    expect(getByTestId('location-intel-sheet')).toBeTruthy();
  });

  test('tapping a municipality on the map when sheet is hidden restores the sheet', () => {
    const { getByTestId, getAllByText } = render(
      <MapScreen
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
        onSignOut={mockOnSignOut}
      />,
    );

    // Sheet is initially closed
    expect(getByTestId('sheet-show-pill-btn')).toBeTruthy();

    // Tap Bogo City on the map
    const bogoPath = getByTestId('muni-path-City of Bogo');
    fireEvent.press(bogoPath);

    // Sheet should now be restored and show Bogo City
    expect(getByTestId('location-intel-sheet')).toBeTruthy();
    expect(getAllByText(/Bogo/i).length).toBeGreaterThan(0);
  });

  test('passing initialProjectId selects project and opens detail modal', async () => {
    const { getByTestId } = render(
      <MapScreen
        initialProjectId="24HD0012"
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
        onSignOut={mockOnSignOut}
      />,
    );

    await waitFor(() => expect(getByTestId('project-detail-modal')).toBeTruthy());
  });

  test('typing a place name live matches location and selects municipality', () => {
    const { getByTestId, getAllByText } = render(
      <MapScreen
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
        onSignOut={mockOnSignOut}
      />,
    );

    const searchInput = getByTestId('map-search-input');
    fireEvent.changeText(searchInput, 'bogo');

    expect(getAllByText(/Bogo/i).length).toBeGreaterThan(0);
  });
});
