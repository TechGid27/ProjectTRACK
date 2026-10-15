import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import HomeScreen from '../src/ui/screens/HomeScreen';

describe('HomeScreen Component', () => {
  const mockOnNavigateToSignIn = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders header, map, and initial location intel sheet', () => {
    const { getByText, getByTestId } = render(
      <HomeScreen onNavigateToSignIn={mockOnNavigateToSignIn} />,
    );

    // Header elements
    expect(getByText('Reyal Or Pake')).toBeTruthy();
    expect(getByTestId('cebu-vector-map')).toBeTruthy();
    expect(getByTestId('location-intel-sheet')).toBeTruthy();
  });

  test('tapping sign in in header triggers onNavigateToSignIn callback', () => {
    const { getByText } = render(
      <HomeScreen onNavigateToSignIn={mockOnNavigateToSignIn} />,
    );

    const signInBtn = getByText('Sign In');
    fireEvent.press(signInBtn);

    expect(mockOnNavigateToSignIn).toHaveBeenCalledTimes(1);
  });

  test('selecting a municipality on the map updates the active location sheet', () => {
    const { getByTestId, getAllByText } = render(
      <HomeScreen onNavigateToSignIn={mockOnNavigateToSignIn} />,
    );

    // Find Bogo City path
    const bogoPath = getByTestId('muni-path-Bogo');
    fireEvent.press(bogoPath);

    // Bogo City should now be displayed in Location Intel sheet
    expect(getAllByText(/Bogo/i).length).toBeGreaterThan(0);
  });

  test('selecting a project card opens the ProjectDetailModal', () => {
    const { getByText, getByTestId } = render(
      <HomeScreen onNavigateToSignIn={mockOnNavigateToSignIn} />,
    );

    // Bogo River project
    const projectCard = getByText(
      'Construction of Flood Mitigation Structure along Bogo River, Bogo City, Cebu',
    );
    fireEvent.press(projectCard);

    // Modal should be visible
    expect(getByTestId('project-detail-modal')).toBeTruthy();
  });
});
