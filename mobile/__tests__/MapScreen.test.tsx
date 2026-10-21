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
    expect(getByTestId('sheet-show-pill-btn')).toBeTruthy();
    expect(getByTestId('open-chat-bot-btn')).toBeTruthy();
    expect(getByTestId('open-about-map-btn')).toBeTruthy();
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
});
