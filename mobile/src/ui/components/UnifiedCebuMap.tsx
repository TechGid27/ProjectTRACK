import React, { forwardRef } from 'react';
import CebuVectorMap from './CebuVectorMap';
import { Pin, HierarchyFilterTier } from '../../core/types';
import { RegionPreset } from '../../core/geoUtils';

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
  focusPreset?: (preset: RegionPreset) => void;
}

const UnifiedCebuMap = forwardRef<UnifiedCebuMapRef, UnifiedCebuMapProps>((props, ref) => {
  return <CebuVectorMap ref={ref as any} {...props} />;
});

export default UnifiedCebuMap;
