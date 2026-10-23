import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ContractorRankingScreen from '../src/ui/screens/ContractorRankingScreen';
import { api } from '../src/services/api';
import { Contractor, ProjectDetail } from '../src/core/types';

// Live-only: the screen pulls its data from the backend via `api`. Mock it so the
// tests render deterministic data without a live server.
const MOCK_CONTRACTORS: Contractor[] = [
  { contractor: 'WTG CONSTRUCTION & DEVELOPMENT CORP.', code: '12884', total_budget: 1845000000, project_count: 14 },
  { contractor: 'QM BUILDERS', code: '05432', total_budget: 1520600000, project_count: 19 },
  { contractor: 'FIRST GRANDEUR BUILDERS', code: '09811', total_budget: 875400000, project_count: 11 },
];

const MOCK_PROJECTS: ProjectDetail[] = [
  {
    id: '24HD0012',
    title: 'Flood Control along Bogo River',
    contractor: 'WTG CONSTRUCTION & DEVELOPMENT CORP.',
    budget: 49000000,
    status: 'Ongoing',
    lgu: 'Bogo City',
  },
];

describe('ContractorRankingScreen Component', () => {
  const mockOnBackToMap = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(api, 'fetchTopContractors').mockResolvedValue(MOCK_CONTRACTORS);
    jest.spyOn(api, 'searchProjects').mockResolvedValue(MOCK_PROJECTS);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('renders header, title, and live top contractor cards', async () => {
    const { getByText, getByTestId } = render(
      <ContractorRankingScreen onBackToMap={mockOnBackToMap} />,
    );

    expect(getByText('Contractor Ranking')).toBeTruthy();
    expect(getByText('DPWH CEBU')).toBeTruthy();
    expect(getByTestId('contractor-search-input')).toBeTruthy();

    // Live data resolves asynchronously.
    await waitFor(() => expect(getByText('🥇')).toBeTruthy());
    expect(getByText('🥈')).toBeTruthy();
    expect(getByText('🥉')).toBeTruthy();
    expect(getByText('WTG CONSTRUCTION & DEVELOPMENT CORP.')).toBeTruthy();
  });

  test('filters contractors when typing into search box', async () => {
    const { getByTestId, getByText, queryByText } = render(
      <ContractorRankingScreen onBackToMap={mockOnBackToMap} />,
    );

    await waitFor(() => expect(getByText('WTG CONSTRUCTION & DEVELOPMENT CORP.')).toBeTruthy());

    const searchInput = getByTestId('contractor-search-input');
    fireEvent.changeText(searchInput, 'QM BUILDERS');

    expect(getByText('QM BUILDERS')).toBeTruthy();
    expect(queryByText('WTG CONSTRUCTION & DEVELOPMENT CORP.')).toBeNull();
  });

  test('shows empty notice when no contractor matches search', async () => {
    const { getByTestId, getByText } = render(
      <ContractorRankingScreen onBackToMap={mockOnBackToMap} />,
    );

    await waitFor(() => expect(getByText('WTG CONSTRUCTION & DEVELOPMENT CORP.')).toBeTruthy());

    const searchInput = getByTestId('contractor-search-input');
    fireEvent.changeText(searchInput, 'NonExistentContractorXYZ');

    expect(getByText('No contractors found')).toBeTruthy();
  });

  test('shows empty-state when backend returns no contractors', async () => {
    (api.fetchTopContractors as jest.Mock).mockResolvedValue([]);
    const { getByTestId, getByText } = render(
      <ContractorRankingScreen onBackToMap={mockOnBackToMap} />,
    );

    await waitFor(() => expect(getByTestId('contractor-ranking-empty')).toBeTruthy());
    expect(getByText('No contractor data')).toBeTruthy();
  });

  test('clicking back button triggers onBackToMap callback', async () => {
    const { getByTestId } = render(
      <ContractorRankingScreen onBackToMap={mockOnBackToMap} />,
    );

    const backBtn = getByTestId('back-to-map-btn');
    fireEvent.press(backBtn);

    expect(mockOnBackToMap).toHaveBeenCalledTimes(1);
  });

  test('tapping a contractor card opens projects drilldown modal', async () => {
    const mockOnNavigateToProjectOnMap = jest.fn();
    const { getByTestId, getAllByText } = render(
      <ContractorRankingScreen
        onBackToMap={mockOnBackToMap}
        onNavigateToProjectOnMap={mockOnNavigateToProjectOnMap}
      />,
    );

    const card = await waitFor(() => getByTestId('contractor-card-1'));
    fireEvent.press(card);

    await waitFor(() =>
      expect(getAllByText('WTG CONSTRUCTION & DEVELOPMENT CORP.').length).toBeGreaterThan(0),
    );
    expect(getByTestId('close-contractor-modal-btn')).toBeTruthy();
  });
});
