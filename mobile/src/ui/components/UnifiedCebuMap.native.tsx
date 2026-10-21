import React, { forwardRef } from 'react';
import MapLibreCebuMap from './MapLibreCebuMap';
import CebuVectorMap from './CebuVectorMap';
import { Pin } from '../../core/types';

let MapLibreGL: any = null;
try {
  MapLibreGL = require('@maplibre/maplibre-react-native');
} catch {
  MapLibreGL = null;
}

export interface UnifiedCebuMapProps {
  selectedMunicipality?: string | null;
  selectedPinId?: string | null;
  pins?: Pin[];
  onSelectMunicipality?: (name: string) => void;
  onSelectPin?: (pin: Pin) => void;
  width?: number;
  height?: number;
  testID?: string;
}

export interface UnifiedCebuMapRef {
  animateToCoordinates: (lat: number, lng: number, zoomOrDelta?: number) => void;
  recenter: () => void;
}

const UnifiedCebuMap = forwardRef<UnifiedCebuMapRef, UnifiedCebuMapProps>((props, ref) => {
  if (!MapLibreGL) {
    return <CebuVectorMap ref={ref as any} {...props} />;
  }
  return <MapLibreCebuMap ref={ref as any} {...props} />;
});

export default UnifiedCebuMap;
