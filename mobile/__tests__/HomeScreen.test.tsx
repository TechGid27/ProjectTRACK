import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import HomeScreen from '../src/ui/screens/HomeScreen';

describe('HomeScreen Component (Mobile Redesign)', () => {
  const mockOnNavigateToSignIn = jest.fn();
  const mockOnNavigateToContractors = jest.fn();
  const mockOnNavigateToMap = jest.fn();
  const mockOnSignOut = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders mobile app header, KPI vital stats, quick actions, and map teaser', () => {
    const { getByText, getByTestId } = render(
      <HomeScreen
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
        onNavigateToMap={mockOnNavigateToMap}
        onSignOut={mockOnSignOut}
      />,
    );

    // Header elements
    expect(getByText('ProjectTRACK')).toBeTruthy();
    expect(getByTestId('mobile-app-header')).toBeTruthy();

    // KPI stats section
    expect(getByTestId('kpi-vital-stats')).toBeTruthy();
    expect(getByText('Tracked Projects')).toBeTruthy();
    expect(getByText('Monitored Budget')).toBeTruthy();
    expect(getByText('Delayed / Flagged')).toBeTruthy();
    expect(getByText('LGUs Monitored')).toBeTruthy();

    // Quick action shortcuts
    expect(getByTestId('quick-actions-section')).toBeTruthy();
    expect(getByText('Explore Map')).toBeTruthy();
    expect(getByText('Field Audit')).toBeTruthy();
    expect(getByText('Contractors')).toBeTruthy();

    // Map teaser card
    expect(getByTestId('map-teaser-card')).toBeTruthy();
    expect(getByTestId('open-full-map-btn')).toBeTruthy();

    // Floating AI button
    expect(getByTestId('open-chat-bot-btn')).toBeTruthy();

    // FAQs section
    expect(getByTestId('faqs-section')).toBeTruthy();
  });

  test('tapping sign in in header triggers onNavigateToSignIn callback', () => {
    const { getByTestId } = render(
      <HomeScreen
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
        onNavigateToMap={mockOnNavigateToMap}
      />,
    );

    const signInBtn = getByTestId('sign-in-nav-btn');
    fireEvent.press(signInBtn);

    expect(mockOnNavigateToSignIn).toHaveBeenCalledTimes(1);
  });

  test('tapping "Explore Map" quick action triggers onNavigateToMap', () => {
    const { getByTestId } = render(
      <HomeScreen
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
        onNavigateToMap={mockOnNavigateToMap}
      />,
    );

    const mapActionBtn = getByTestId('quick-action-map');
    fireEvent.press(mapActionBtn);

    expect(mockOnNavigateToMap).toHaveBeenCalledTimes(1);
  });

  test('tapping "Full Map →" in map teaser triggers onNavigateToMap', () => {
    const { getByTestId } = render(
      <HomeScreen
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
        onNavigateToMap={mockOnNavigateToMap}
      />,
    );

    const fullMapBtn = getByTestId('open-full-map-btn');
    fireEvent.press(fullMapBtn);

    expect(mockOnNavigateToMap).toHaveBeenCalledTimes(1);
  });

  test('tapping Contractors in quick actions triggers onNavigateToContractors callback', () => {
    const { getByTestId } = render(
      <HomeScreen
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
        onNavigateToMap={mockOnNavigateToMap}
      />,
    );

    const contractorsActionBtn = getByTestId('quick-action-contractors');
    fireEvent.press(contractorsActionBtn);

    expect(mockOnNavigateToContractors).toHaveBeenCalledTimes(1);
  });

  test('tapping a popular LGU pill triggers onNavigateToMap with normalized LGU', () => {
    const { getByTestId } = render(
      <HomeScreen
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
        onNavigateToMap={mockOnNavigateToMap}
      />,
    );

    const bogoPill = getByTestId('muni-grid-btn-City of Bogo');
    fireEvent.press(bogoPill);

    expect(mockOnNavigateToMap).toHaveBeenCalledWith('Bogo City');
  });

  test('opening and closing All 53 LGUs modal', () => {
    const { getByTestId, getByText } = render(
      <HomeScreen
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
        onNavigateToMap={mockOnNavigateToMap}
      />,
    );

    const viewAllBtn = getByTestId('view-all-53-lgus-btn');
    fireEvent.press(viewAllBtn);

    expect(getByText('All 53 Cebu LGUs')).toBeTruthy();
    expect(getByTestId('all-lgus-search-input')).toBeTruthy();
  });

  test('expanding and collapsing FAQ accordion item', () => {
    const { getByTestId, getByText, queryByText } = render(
      <HomeScreen
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
        onNavigateToMap={mockOnNavigateToMap}
      />,
    );

    const firstFaqBtn = getByTestId('faq-toggle-btn-0');
    fireEvent.press(firstFaqBtn);

    // Answer should be visible
    expect(
      getByText(/ProjectTRACK aggregates official data/i),
    ).toBeTruthy();

    // Toggle again to collapse
    fireEvent.press(firstFaqBtn);
    expect(
      queryByText(/ProjectTRACK aggregates official data/i),
    ).toBeNull();
  });

  test('does not render search bar on home page', () => {
    const { queryByTestId } = render(
      <HomeScreen
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
        onNavigateToMap={mockOnNavigateToMap}
      />,
    );

    expect(queryByTestId('home-search-input')).toBeNull();
  });

  test('renders user avatar when currentUser is provided and triggers onSignOut', () => {
    const { getByTestId } = render(
      <HomeScreen
        currentUser={{ email: 'auditor@dpwh.gov.ph' }}
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
        onNavigateToMap={mockOnNavigateToMap}
        onSignOut={mockOnSignOut}
      />,
    );

    const signOutBtn = getByTestId('sign-out-btn');
    fireEvent.press(signOutBtn);

    expect(mockOnSignOut).toHaveBeenCalledTimes(1);
  });

  test('dynamically fetches and renders the 4 vital stats from api', async () => {
    const { getByText, findByText } = render(
      <HomeScreen
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
        onNavigateToMap={mockOnNavigateToMap}
      />,
    );

    expect(getByText('Tracked Projects')).toBeTruthy();
    expect(getByText('Monitored Budget')).toBeTruthy();
    expect(getByText('Delayed / Flagged')).toBeTruthy();
    expect(getByText('LGUs Monitored')).toBeTruthy();

    expect(await findByText(/53 of 53/i)).toBeTruthy();
  });

  test('pull-to-refresh on home screen executes handleRefresh without reference errors', async () => {
    const { getByTestId } = render(
      <HomeScreen
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
        onNavigateToMap={mockOnNavigateToMap}
      />,
    );

    const refreshControl = getByTestId('home-refresh-control');
    expect(refreshControl.props.refreshing).toBe(false);
    fireEvent(refreshControl, 'refresh');
  });
});
