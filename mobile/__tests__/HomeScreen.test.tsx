import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import HomeScreen from '../src/ui/screens/HomeScreen';

describe('HomeScreen Component', () => {
  const mockOnNavigateToSignIn = jest.fn();
  const mockOnNavigateToContractors = jest.fn();
  const mockOnSignOut = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders header, map, "Cebu in text", stats, and location intel sheet', () => {
    const { getByText, getByTestId } = render(
      <HomeScreen
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
        onSignOut={mockOnSignOut}
      />,
    );

    // Header elements
    expect(getByText('Reyal Or Pake')).toBeTruthy();
    expect(getByTestId('cebu-vector-map')).toBeTruthy();
    expect(getByTestId('location-intel-sheet')).toBeTruthy();

    // Website parity sections
    expect(getByText('Cebu, in text')).toBeTruthy();
    expect(getByText('Browse by municipality')).toBeTruthy();
    expect(getByText('Frequently asked questions')).toBeTruthy();
    expect(getByTestId('open-about-map-btn')).toBeTruthy();
    expect(getByTestId('open-chat-bot-btn')).toBeTruthy();
  });

  test('tapping sign in in header triggers onNavigateToSignIn callback', () => {
    const { getByTestId } = render(
      <HomeScreen
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
        onSignOut={mockOnSignOut}
      />,
    );

    const signInBtn = getByTestId('sign-in-nav-btn');
    fireEvent.press(signInBtn);

    expect(mockOnNavigateToSignIn).toHaveBeenCalledTimes(1);
  });

  test('tapping contractors button triggers onNavigateToContractors callback', () => {
    const { getByTestId } = render(
      <HomeScreen
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
        onSignOut={mockOnSignOut}
      />,
    );

    const contractorsNavBtn = getByTestId('nav-contractors-btn');
    fireEvent.press(contractorsNavBtn);

    expect(mockOnNavigateToContractors).toHaveBeenCalledTimes(1);
  });

  test('selecting a municipality on the map updates the active location sheet', () => {
    const { getByTestId, getAllByText } = render(
      <HomeScreen
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
      />,
    );

    // Find Bogo City path
    const bogoPath = getByTestId('muni-path-City of Bogo');
    fireEvent.press(bogoPath);

    // Bogo City should now be displayed in Location Intel sheet
    expect(getAllByText(/Bogo/i).length).toBeGreaterThan(0);
  });

  test('tapping an LGU chip in the "Browse by municipality" grid selects that municipality', () => {
    const { getByTestId, getAllByText } = render(
      <HomeScreen
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
      />,
    );

    const carcarBtn = getByTestId('muni-grid-btn-Carcar City');
    fireEvent.press(carcarBtn);

    expect(getAllByText(/Carcar/i).length).toBeGreaterThan(0);
  });

  test('expanding and collapsing FAQ accordion item', () => {
    const { getByTestId, getByText, queryByText } = render(
      <HomeScreen
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
      />,
    );

    const faqToggle = getByTestId('faq-toggle-btn-0');
    // Initially not showing answer
    expect(queryByText(/ProjectTRACK loads DPWH public-works projects/)).toBeNull();

    // Tap to expand
    fireEvent.press(faqToggle);
    expect(getByText(/ProjectTRACK loads DPWH public-works projects/)).toBeTruthy();

    // Tap again to collapse
    fireEvent.press(faqToggle);
    expect(queryByText(/ProjectTRACK loads DPWH public-works projects/)).toBeNull();
  });

  test('opens and closes AboutMapModal', () => {
    const { getByTestId, queryByTestId } = render(
      <HomeScreen
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
      />,
    );

    const openAboutBtn = getByTestId('open-about-map-btn');
    fireEvent.press(openAboutBtn);

    expect(getByTestId('about-map-modal')).toBeTruthy();

    const closeBtn = getByTestId('close-about-map-btn');
    fireEvent.press(closeBtn);

    expect(queryByTestId('about-map-modal')).toBeNull();
  });

  test('opens and closes ChatBotModal', () => {
    const { getByTestId, queryByTestId } = render(
      <HomeScreen
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
      />,
    );

    const openChatBtn = getByTestId('open-chat-bot-btn');
    fireEvent.press(openChatBtn);

    expect(getByTestId('chatbot-modal')).toBeTruthy();

    const closeBtn = getByTestId('close-chat-btn');
    fireEvent.press(closeBtn);

    expect(queryByTestId('chatbot-modal')).toBeNull();
  });

  test('selecting a project card opens the ProjectDetailModal', () => {
    const { getByText, getByTestId } = render(
      <HomeScreen
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
      />,
    );

    // Bogo River project
    const projectCard = getByText(
      'Construction of Flood Mitigation Structure along Bogo River, Bogo City, Cebu',
    );
    fireEvent.press(projectCard);

    // Modal should be visible
    expect(getByTestId('project-detail-modal')).toBeTruthy();
  });

  test('renders MapFilterBar and allows toggling status filters', () => {
    const { getByTestId } = render(
      <HomeScreen
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
      />,
    );

    expect(getByTestId('map-filter-bar')).toBeTruthy();
    const ongoingFilter = getByTestId('filter-btn-ongoing');
    fireEvent.press(ongoingFilter);

    const delayedFilter = getByTestId('filter-btn-delayed');
    fireEvent.press(delayedFilter);
  });

  test('tapping field audit button on a project card opens FieldAuditorModal', () => {
    const { getByTestId, queryByTestId } = render(
      <HomeScreen
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onNavigateToContractors={mockOnNavigateToContractors}
      />,
    );

    // Initial project 24HD0012 should have a field audit button
    const auditBtn = getByTestId('field-audit-btn-24HD0012');
    fireEvent.press(auditBtn);

    // FieldAuditorModal should now be open
    expect(getByTestId('field-auditor-modal')).toBeTruthy();

    // Close FieldAuditorModal
    const closeBtn = getByTestId('close-auditor-btn');
    fireEvent.press(closeBtn);

    expect(queryByTestId('field-auditor-modal')).toBeNull();
  });
});

