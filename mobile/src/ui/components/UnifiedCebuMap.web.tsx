import React, { forwardRef } from 'react';
import CebuVectorMap, { CebuVectorMapRef } from './CebuVectorMap';
import { Pin } from '../../core/types';

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
  return <CebuVectorMap ref={ref as any} {...props} />;
});

export default UnifiedCebuMap;
