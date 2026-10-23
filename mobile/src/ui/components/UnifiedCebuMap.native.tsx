import React, { forwardRef } from 'react';
import { NativeModules } from 'react-native';
import MapLibreCebuMap from './MapLibreCebuMap';
import CebuVectorMap from './CebuVectorMap';
import { Pin, HierarchyFilterTier } from '../../core/types';

// Only route to MapLibre when its native module is actually linked — the JS
// package loads even without it and MapView crashes at render time.
let MapLibreGL: any = null;
try {
  MapLibreGL = NativeModules?.MLRNModule
    ? require('@maplibre/maplibre-react-native')
    : null;
} catch {
  MapLibreGL = null;
}

export interface UnifiedCebuMapProps {
  selectedMunicipality?: string | null;
  selectedPinId?: string | null;
  hierarchyTier?: HierarchyFilterTier;
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
