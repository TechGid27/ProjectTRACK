import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import MapFilterBar from '../src/ui/components/MapFilterBar';

describe('MapFilterBar Component', () => {
  const mockOnSelectFilter = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders all 5 map filter pills', () => {
    const { getByTestId, getByText } = render(
      <MapFilterBar
        activeFilter="ALL"
        onSelectFilter={mockOnSelectFilter}
      />,
    );

    expect(getByTestId('map-filter-bar')).toBeTruthy();
    expect(getByTestId('filter-btn-all')).toBeTruthy();
    expect(getByTestId('filter-btn-ongoing')).toBeTruthy();
    expect(getByTestId('filter-btn-completed')).toBeTruthy();
    expect(getByTestId('filter-btn-delayed')).toBeTruthy();
    expect(getByTestId('filter-btn-high_budget')).toBeTruthy();

    expect(getByText('All Projects')).toBeTruthy();
    expect(getByText('Ongoing')).toBeTruthy();
    expect(getByText('Completed')).toBeTruthy();
    expect(getByText('Delayed')).toBeTruthy();
    expect(getByText('>₱50M Budget')).toBeTruthy();
  });

  test('tapping filter button invokes onSelectFilter with the corresponding filter ID', () => {
    const { getByTestId } = render(
      <MapFilterBar
        activeFilter="ALL"
        onSelectFilter={mockOnSelectFilter}
      />,
    );

    fireEvent.press(getByTestId('filter-btn-ongoing'));
    expect(mockOnSelectFilter).toHaveBeenCalledWith('ONGOING');

    fireEvent.press(getByTestId('filter-btn-delayed'));
    expect(mockOnSelectFilter).toHaveBeenCalledWith('DELAYED');

    fireEvent.press(getByTestId('filter-btn-completed'));
    expect(mockOnSelectFilter).toHaveBeenCalledWith('COMPLETED');

    fireEvent.press(getByTestId('filter-btn-high_budget'));
    expect(mockOnSelectFilter).toHaveBeenCalledWith('HIGH_BUDGET');
  });
});
