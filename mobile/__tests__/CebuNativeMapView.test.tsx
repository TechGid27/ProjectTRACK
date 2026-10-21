import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import CebuNativeMapView, { CebuNativeMapViewRef } from '../src/ui/components/CebuNativeMapView';

describe('CebuNativeMapView Component', () => {
  const mockOnSelectMunicipality = jest.fn();
  const mockOnSelectPin = jest.fn();

  const mockPins = [
    {
      id: 'CEB-01',
      name: 'Osmeña Boulevard Drainage Project',
      lat: 10.3157,
      lng: 123.8854,
      tone: 'teal',
      status: 'Ongoing',
      lgu: 'Cebu City',
      description: 'DPWH Drainage Rehabilitation',
    },
    {
      id: 'CEB-02',
      name: 'Mandaue Coastal Road Bridge',
      lat: 10.33,
      lng: 123.94,
      tone: 'warning',
      status: 'Delayed',
      lgu: 'Mandaue City',
      description: 'Bridge retrofitting',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders native map and center-right floating controls', () => {
    const { getByTestId } = render(
      <CebuNativeMapView
        pins={mockPins as any}
        onSelectMunicipality={mockOnSelectMunicipality}
        onSelectPin={mockOnSelectPin}
        width={360}
        height={600}
      />,
    );

    // Map container
    expect(getByTestId('cebu-native-map')).toBeTruthy();

    // Center-Right Floating Controls
    expect(getByTestId('center-right-controls')).toBeTruthy();
    expect(getByTestId('zoom-in-btn')).toBeTruthy();
    expect(getByTestId('zoom-out-btn')).toBeTruthy();
    expect(getByTestId('recenter-btn')).toBeTruthy();

    // Zoom badge
    expect(getByTestId('zoom-level-badge')).toBeTruthy();
  });

  test('tapping zoom in and zoom out buttons triggers light haptic impact without throwing', () => {
    const { getByTestId } = render(
      <CebuNativeMapView
        pins={mockPins as any}
        onSelectMunicipality={mockOnSelectMunicipality}
        onSelectPin={mockOnSelectPin}
      />,
    );

    const zoomInBtn = getByTestId('zoom-in-btn');
    const zoomOutBtn = getByTestId('zoom-out-btn');
    const recenterBtn = getByTestId('recenter-btn');

    fireEvent.press(zoomInBtn);
    fireEvent.press(zoomOutBtn);
    fireEvent.press(recenterBtn);
  });

  test('tapping a pin triggers onSelectPin callback', () => {
    const { getByTestId } = render(
      <CebuNativeMapView
        selectedMunicipality="Cebu City"
        pins={mockPins as any}
        onSelectPin={mockOnSelectPin}
      />,
    );

    const pin1 = getByTestId('native-pin-CEB-01');
    fireEvent.press(pin1);

    expect(mockOnSelectPin).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'CEB-01' }),
    );
  });

  test('imperative ref methods can be called safely without error', () => {
    const ref = React.createRef<CebuNativeMapViewRef>();

    render(
      <CebuNativeMapView
        ref={ref}
        pins={mockPins as any}
      />,
    );

    expect(ref.current).toBeDefined();
    ref.current?.animateToCoordinates(10.3157, 123.8854, 0.05);
    ref.current?.recenter();
  });
});
