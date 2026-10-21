import React, { createRef } from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import UnifiedCebuMap, { UnifiedCebuMapRef } from '../src/ui/components/UnifiedCebuMap';
import { Pin } from '../src/core/types';

describe('UnifiedCebuMap Component (Platform-Split Web/Native)', () => {
  const mockPins: Pin[] = [
    {
      id: 'TEST-001',
      name: 'Bogo Flood Control Facility',
      lat: 10.952,
      lng: 124.005,
      tone: 'default',
      lgu: 'Bogo City',
      description: 'Major drainage and retaining wall construction',
      budget: 45000000,
      status: 'Ongoing',
    },
    {
      id: 'TEST-002',
      name: 'Dalaguete Farm-to-Market Road',
      lat: 9.761,
      lng: 123.535,
      tone: 'warning',
      lgu: 'Dalaguete',
      description: 'Road concreting phase 2',
      budget: 28000000,
      status: 'Delayed',
    },
  ];

  test('renders map container and center-right zoom controls', () => {
    const { getByTestId } = render(
      <UnifiedCebuMap
        pins={mockPins}
        width={360}
        height={500}
      />,
    );

    expect(getByTestId('cebu-vector-map')).toBeTruthy();
    expect(getByTestId('zoom-in-btn')).toBeTruthy();
    expect(getByTestId('zoom-out-btn')).toBeTruthy();
    expect(getByTestId('zoom-reset-btn')).toBeTruthy();
  });

  test('zooms in and out using center-right floating buttons', () => {
    const { getByTestId, queryByTestId } = render(
      <UnifiedCebuMap
        pins={mockPins}
        width={360}
        height={500}
      />,
    );

    // Initial scale is 1.0 (badge is hidden)
    expect(queryByTestId('zoom-level-badge')).toBeNull();

    // Zoom in
    fireEvent.press(getByTestId('zoom-in-btn'));
    expect(getByTestId('zoom-level-badge')).toBeTruthy();

    // Reset view
    fireEvent.press(getByTestId('zoom-reset-btn'));
    expect(queryByTestId('zoom-level-badge')).toBeNull();
  });

  test('supports imperative ref methods: animateToCoordinates and recenter', () => {
    const ref = createRef<UnifiedCebuMapRef>();
    const { getByTestId, queryByTestId } = render(
      <UnifiedCebuMap
        ref={ref}
        pins={mockPins}
        width={360}
        height={500}
      />,
    );

    expect(ref.current).toBeTruthy();
    expect(typeof ref.current?.animateToCoordinates).toBe('function');
    expect(typeof ref.current?.recenter).toBe('function');

    // Trigger animate to coordinates (spatial navigation)
    ref.current?.animateToCoordinates(10.952, 124.005, 3.5);
    expect(getByTestId('zoom-level-badge')).toBeTruthy();

    // Trigger recenter
    ref.current?.recenter();
    expect(queryByTestId('zoom-level-badge')).toBeNull();
  });

  test('invokes onSelectMunicipality when a municipality path is pressed', () => {
    const onSelectMunicipality = jest.fn();
    const { getByTestId } = render(
      <UnifiedCebuMap
        pins={mockPins}
        onSelectMunicipality={onSelectMunicipality}
        width={360}
        height={500}
      />,
    );

    const bogoPath = getByTestId('muni-path-City of Bogo');
    fireEvent.press(bogoPath);
    expect(onSelectMunicipality).toHaveBeenCalledWith('Bogo City');
  });
});
