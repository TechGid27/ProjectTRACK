import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ContractorRankingScreen from '../src/ui/screens/ContractorRankingScreen';

describe('ContractorRankingScreen Component', () => {
  const mockOnBackToMap = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders header, title, and initial top contractor cards', () => {
    const { getByText, getByTestId } = render(
      <ContractorRankingScreen onBackToMap={mockOnBackToMap} />,
    );

    expect(getByText('Contractor Ranking')).toBeTruthy();
    expect(getByText('DPWH CEBU')).toBeTruthy();
    expect(getByTestId('contractor-search-input')).toBeTruthy();

    // Check top 3 contractor medals
    expect(getByText('🥇')).toBeTruthy();
    expect(getByText('🥈')).toBeTruthy();
    expect(getByText('🥉')).toBeTruthy();

    // Check top contractor name
    expect(getByText('WTG CONSTRUCTION & DEVELOPMENT CORP.')).toBeTruthy();
  });

  test('filters contractors when typing into search box', () => {
    const { getByTestId, getByText, queryByText } = render(
      <ContractorRankingScreen onBackToMap={mockOnBackToMap} />,
    );

    const searchInput = getByTestId('contractor-search-input');
    fireEvent.changeText(searchInput, 'QM BUILDERS');

    // QM BUILDERS should be visible
    expect(getByText('QM BUILDERS')).toBeTruthy();
    // WTG should be filtered out
    expect(queryByText('WTG CONSTRUCTION & DEVELOPMENT CORP.')).toBeNull();
  });

  test('shows empty notice when no contractor matches search', () => {
    const { getByTestId, getByText } = render(
      <ContractorRankingScreen onBackToMap={mockOnBackToMap} />,
    );

    const searchInput = getByTestId('contractor-search-input');
    fireEvent.changeText(searchInput, 'NonExistentContractorXYZ');

    expect(getByText('No contractors found')).toBeTruthy();
  });

  test('clicking back button triggers onBackToMap callback', () => {
    const { getByTestId } = render(
      <ContractorRankingScreen onBackToMap={mockOnBackToMap} />,
    );

    const backBtn = getByTestId('back-to-map-btn');
    fireEvent.press(backBtn);

    expect(mockOnBackToMap).toHaveBeenCalledTimes(1);
  });

  test('tapping a contractor card opens projects drilldown modal', () => {
    const mockOnNavigateToProjectOnMap = jest.fn();
    const { getByTestId, getAllByText } = render(
      <ContractorRankingScreen
        onBackToMap={mockOnBackToMap}
        onNavigateToProjectOnMap={mockOnNavigateToProjectOnMap}
      />,
    );

    const card = getByTestId('contractor-card-1');
    fireEvent.press(card);

    expect(getAllByText('WTG CONSTRUCTION & DEVELOPMENT CORP.').length).toBeGreaterThan(0);
    expect(getByTestId('close-contractor-modal-btn')).toBeTruthy();
  });
});
