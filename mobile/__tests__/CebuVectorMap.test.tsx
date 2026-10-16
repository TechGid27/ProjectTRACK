import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import CebuVectorMap from '../src/ui/components/CebuVectorMap';
import { pins } from '../src/data/pins';
import cebuData from '../src/assets/cebuMunicipalities.json';

describe('CebuVectorMap Component', () => {
  const mockOnSelectMunicipality = jest.fn();
  const mockOnSelectPin = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders vector map with testID and renders municipality paths', () => {
    const { getByTestId, getAllByTestId } = render(
      <CebuVectorMap
        onSelectMunicipality={mockOnSelectMunicipality}
        onSelectPin={mockOnSelectPin}
      />,
    );

    const mapContainer = getByTestId('cebu-vector-map');
    expect(mapContainer).toBeTruthy();

    const paths = getAllByTestId(/^muni-path-/);
    // Cebu has 53 LGUs
    expect(paths.length).toBe(cebuData.features.length);
  });

  test('clicking a municipality path triggers onSelectMunicipality with normalized name', () => {
    const { getByTestId } = render(
      <CebuVectorMap
        onSelectMunicipality={mockOnSelectMunicipality}
        onSelectPin={mockOnSelectPin}
      />,
    );

    // Find Bogo City path
    const bogoPath = getByTestId('muni-path-City of Bogo');
    fireEvent.press(bogoPath);

    expect(mockOnSelectMunicipality).toHaveBeenCalledTimes(1);
    expect(mockOnSelectMunicipality).toHaveBeenCalledWith('Bogo City');
  });

  test('renders glowing project site pins', () => {
    const { getAllByTestId } = render(
      <CebuVectorMap
        pins={pins}
        onSelectMunicipality={mockOnSelectMunicipality}
        onSelectPin={mockOnSelectPin}
      />,
    );

    const renderedPins = getAllByTestId(/^map-pin-/);
    expect(renderedPins.length).toBe(pins.length);
  });

  test('clicking a pin triggers onSelectPin with pin data', () => {
    const { getByTestId } = render(
      <CebuVectorMap
        pins={pins}
        onSelectMunicipality={mockOnSelectMunicipality}
        onSelectPin={mockOnSelectPin}
      />,
    );

    const firstPin = pins[0];
    const pinElement = getByTestId(`map-pin-${firstPin.id}`);
    fireEvent.press(pinElement);

    expect(mockOnSelectPin).toHaveBeenCalledTimes(1);
    expect(mockOnSelectPin).toHaveBeenCalledWith(firstPin);
  });

  test('highlights selected municipality with active color', () => {
    const { getByTestId } = render(
      <CebuVectorMap
        selectedMunicipality="Bogo City"
        onSelectMunicipality={mockOnSelectMunicipality}
        onSelectPin={mockOnSelectPin}
      />,
    );

    const bogoPath = getByTestId('muni-path-City of Bogo');
    expect(bogoPath.props.fill).toBe('#1f3d3c'); // Active teal fill
  });

  test('tapping zoom in button increases zoom and displays zoom level badge', () => {
    const { getByTestId, queryByTestId } = render(
      <CebuVectorMap
        onSelectMunicipality={mockOnSelectMunicipality}
        onSelectPin={mockOnSelectPin}
      />,
    );

    // Initial scale is 1.0x so badge is not visible
    expect(queryByTestId('zoom-level-badge')).toBeNull();

    // Tap zoom in
    const zoomInBtn = getByTestId('zoom-in-btn');
    fireEvent.press(zoomInBtn);

    // Badge should now appear showing scale
    const badge = getByTestId('zoom-level-badge');
    expect(badge).toBeTruthy();

    // Tap reset
    const resetBtn = getByTestId('zoom-reset-btn');
    fireEvent.press(resetBtn);

    // Badge should be hidden after reset back to 1.0x
    expect(queryByTestId('zoom-level-badge')).toBeNull();
  });
});
