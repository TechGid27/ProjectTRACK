import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import MapHeader from '../src/ui/components/MapHeader';

describe('MapHeader Component', () => {
  const mockOnSearch = jest.fn();
  const mockOnSignInPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders title, stats badge, and navigation elements', () => {
    const { getByText, getByPlaceholderText } = render(
      <MapHeader
        totalLgus={53}
        totalPins={12}
        onSearch={mockOnSearch}
        onSignInPress={mockOnSignInPress}
      />,
    );

    expect(getByText('ProjectTRACK')).toBeTruthy();
    expect(getByText('Sign In')).toBeTruthy();
    expect(getByPlaceholderText('Search municipality or project...')).toBeTruthy();
  });

  test('typing in search bar triggers onSearch callback', () => {
    const { getByPlaceholderText } = render(
      <MapHeader
        totalLgus={53}
        totalPins={12}
        onSearch={mockOnSearch}
        onSignInPress={mockOnSignInPress}
      />,
    );

    const input = getByPlaceholderText('Search municipality or project...');
    fireEvent.changeText(input, 'Bogo');

    expect(mockOnSearch).toHaveBeenCalledWith('Bogo');
  });

  test('pressing Sign In button calls onSignInPress', () => {
    const { getByText } = render(
      <MapHeader
        totalLgus={53}
        totalPins={12}
        onSearch={mockOnSearch}
        onSignInPress={mockOnSignInPress}
      />,
    );

    const signInBtn = getByText('Sign In');
    fireEvent.press(signInBtn);

    expect(mockOnSignInPress).toHaveBeenCalledTimes(1);
  });
});
