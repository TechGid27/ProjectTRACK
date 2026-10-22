import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import MapScreen from '../src/ui/screens/MapScreen';

describe('MapScreen Component', () => {
  const mockOnNavigateToSignIn = jest.fn();
  const mockOnNavigateToContractors = jest.fn();
  const mockOnSignOut = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders MapHeader, Map View, Hierarchy Bar, and Show Details pill when sheet is initially closed', () => {
    const { getByTestId } = render(
      <MapScreen
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
        onSignOut={mockOnSignOut}
      />,
    );

    expect(getByTestId('map-screen')).toBeTruthy();
    expect(getByTestId('unified-cebu-map')).toBeTruthy();
    expect(getByTestId('cebu-map-hierarchy-bar')).toBeTruthy();
    expect(getByTestId('cebu-region-quick-jump')).toBeTruthy();
    expect(getByTestId('map-header')).toBeTruthy();
    expect(getByTestId('map-filter-bar')).toBeTruthy();
    expect(getByTestId('map-refresh-btn')).toBeTruthy();
    expect(getByTestId('sheet-show-pill-btn')).toBeTruthy();
    expect(getByTestId('open-chat-bot-btn')).toBeTruthy();
    expect(getByTestId('open-about-map-btn')).toBeTruthy();
  });

  test('switching administrative hierarchy tier filters active focus', () => {
    const { getByTestId } = render(
      <MapScreen
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
        onSignOut={mockOnSignOut}
      />,
    );

    const citiesTierBtn = getByTestId('hierarchy-tier-cities');
    expect(citiesTierBtn).toBeTruthy();
    fireEvent.press(citiesTierBtn);

    const muniTierBtn = getByTestId('hierarchy-tier-municipalities');
    expect(muniTierBtn).toBeTruthy();
    fireEvent.press(muniTierBtn);
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

  test('passing initialProjectId selects project and opens detail modal', () => {
    const { getByTestId } = render(
      <MapScreen
        initialProjectId="24HD0012"
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
        onSignOut={mockOnSignOut}
      />,
    );

    expect(getByTestId('project-detail-modal')).toBeTruthy();
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

  test('tapping the floating refresh button invokes handleRefreshMap', () => {
    const { getByTestId } = render(
      <MapScreen
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
        onSignOut={mockOnSignOut}
      />,
    );

    const refreshBtn = getByTestId('map-refresh-btn');
    expect(refreshBtn).toBeTruthy();
    fireEvent.press(refreshBtn);
  });

  test('selecting Cities tier shows city selector chips and tapping a city chip selects it', () => {
    const { getByTestId, getAllByText } = render(
      <MapScreen
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
        onSignOut={mockOnSignOut}
      />,
    );

    const citiesTierBtn = getByTestId('hierarchy-tier-cities');
    fireEvent.press(citiesTierBtn);

    const cityChipsRow = getByTestId('hierarchy-cities-chips-row');
    expect(cityChipsRow).toBeTruthy();

    const cebuCityChip = getByTestId('hierarchy-city-chip-cebu-city');
    expect(cebuCityChip).toBeTruthy();
    fireEvent.press(cebuCityChip);

    expect(getAllByText(/Cebu City/i).length).toBeGreaterThan(0);
  });

  test('clicking a project pin directly opens ProjectDetailModal', () => {
    const { getAllByTestId, getByTestId } = render(
      <MapScreen
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
        onSignOut={mockOnSignOut}
      />,
    );

    const pinsOnMap = getAllByTestId(/^map-pin-/);
    expect(pinsOnMap.length).toBeGreaterThan(0);

    fireEvent.press(pinsOnMap[0]);
    expect(getByTestId('project-detail-modal')).toBeTruthy();
  });

  test('clearing selected LGU returns to full Cebu province overview', () => {
    const { getByTestId, queryByTestId, getAllByText } = render(
      <MapScreen
        initialLgu="Bogo City"
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
        onSignOut={mockOnSignOut}
      />,
    );

    const clearBtn = getByTestId('clear-lgu-selection-btn');
    expect(clearBtn).toBeTruthy();
    fireEvent.press(clearBtn);

    expect(queryByTestId('clear-lgu-selection-btn')).toBeNull();
    expect(getAllByText(/Cebu Province/i).length).toBeGreaterThan(0);
  });
});
