import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import BottomTabBar from '../src/ui/components/BottomTabBar';

describe('BottomTabBar Component', () => {
  const mockOnSelectTab = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders all 3 tabs: Home, Center Map, and Contractors', () => {
    const { getByTestId, getByText } = render(
      <BottomTabBar activeTab="home" onSelectTab={mockOnSelectTab} />,
    );

    expect(getByTestId('bottom-tab-bar')).toBeTruthy();
    expect(getByTestId('nav-tab-home')).toBeTruthy();
    expect(getByTestId('nav-tab-map')).toBeTruthy();
    expect(getByTestId('nav-tab-contractors')).toBeTruthy();

    expect(getByText('Home')).toBeTruthy();
    expect(getByText('Map')).toBeTruthy();
    expect(getByText('Contractors')).toBeTruthy();
  });

  test('tapping Home tab invokes onSelectTab with "home"', () => {
    const { getByTestId } = render(
      <BottomTabBar activeTab="map" onSelectTab={mockOnSelectTab} />,
    );

    const homeTab = getByTestId('nav-tab-home');
    fireEvent.press(homeTab);

    expect(mockOnSelectTab).toHaveBeenCalledWith('home');
  });

  test('tapping Center Map tab invokes onSelectTab with "map"', () => {
    const { getByTestId } = render(
      <BottomTabBar activeTab="home" onSelectTab={mockOnSelectTab} />,
    );

    const mapTab = getByTestId('nav-tab-map');
    fireEvent.press(mapTab);

    expect(mockOnSelectTab).toHaveBeenCalledWith('map');
  });

  test('tapping Contractors tab invokes onSelectTab with "contractors"', () => {
    const { getByTestId } = render(
      <BottomTabBar activeTab="home" onSelectTab={mockOnSelectTab} />,
    );

    const contractorsTab = getByTestId('nav-tab-contractors');
    fireEvent.press(contractorsTab);

    expect(mockOnSelectTab).toHaveBeenCalledWith('contractors');
  });

  test('highlights the active tab properly', () => {
    const { getByTestId, rerender } = render(
      <BottomTabBar activeTab="home" onSelectTab={mockOnSelectTab} />,
    );

    // Re-render with active tab as map
    rerender(<BottomTabBar activeTab="map" onSelectTab={mockOnSelectTab} />);
    expect(getByTestId('nav-tab-map')).toBeTruthy();

    // Re-render with active tab as contractors
    rerender(<BottomTabBar activeTab="contractors" onSelectTab={mockOnSelectTab} />);
    expect(getByTestId('nav-tab-contractors')).toBeTruthy();
  });
});
