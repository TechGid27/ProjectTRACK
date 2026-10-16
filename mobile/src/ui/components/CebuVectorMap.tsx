import React, { useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Path, G, Circle } from 'react-native-svg';
import { Pin, MunicipalityCollection } from '../../core/types';
import {
  computeBoundingBox,
  geoToSvgCoordinates,
  normalizeLguName,
} from '../../core/geoUtils';
import cebuDataRaw from '../../assets/cebuMunicipalities.json';

const cebuData = cebuDataRaw as unknown as MunicipalityCollection;

interface CebuVectorMapProps {
  selectedMunicipality?: string | null;
  selectedPinId?: string | null;
  pins?: Pin[];
  onSelectMunicipality?: (name: string) => void;
  onSelectPin?: (pin: Pin) => void;
  width?: number;
  height?: number;
}

export default function CebuVectorMap({
  selectedMunicipality,
  selectedPinId,
  pins = [],
  onSelectMunicipality,
  onSelectPin,
  width: propWidth,
  height: propHeight,
}: CebuVectorMapProps) {
  const windowDims = useWindowDimensions();

  // Robust dimensions that will never collapse to 0 on web or initial mount
  const width = Math.max(280, propWidth ?? windowDims?.width ?? 360);
  const height = Math.max(
    280,
    propHeight ?? (windowDims?.height ? windowDims.height * 0.65 : 480),
  );

  // 1. Calculate map bounds once
  const bounds = useMemo(() => {
    return computeBoundingBox(cebuData?.features || []);
  }, []);

  // 2. Build SVG path commands for all municipalities
  const pathsData = useMemo(() => {
    return (cebuData?.features || []).map((feature) => {
      const name = feature.properties.name;
      const normalized = normalizeLguName(name);
      let d = '';

      function ringToPath(ring: number[][]) {
        let subPath = '';
        for (let i = 0; i < ring.length; i++) {
          const pt = geoToSvgCoordinates(
            ring[i][0],
            ring[i][1],
            bounds,
            width,
            height,
            16,
          );
          subPath += (i === 0 ? 'M ' : ' L ') + `${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
        }
        return subPath + ' Z ';
      }

      if (feature.geometry.type === 'Polygon') {
        const rings = feature.geometry.coordinates as number[][][];
        for (const ring of rings) {
          d += ringToPath(ring);
        }
      } else if (feature.geometry.type === 'MultiPolygon') {
        const polys = feature.geometry.coordinates as number[][][][];
        for (const poly of polys) {
          for (const ring of poly) {
            d += ringToPath(ring);
          }
        }
      }

      return {
        rawName: name,
        normalizedName: normalized,
        d,
      };
    });
  }, [bounds, width, height]);

  // 3. Precalculate pin coordinates
  const renderedPins = useMemo(() => {
    return pins.map((pin) => {
      const coords = geoToSvgCoordinates(
        pin.lng,
        pin.lat,
        bounds,
        width,
        height,
        16,
      );
      return {
        ...pin,
        x: coords.x,
        y: coords.y,
      };
    });
  }, [pins, bounds, width, height]);

  return (
    <View style={[styles.container, { width, height }]} testID="cebu-vector-map">
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Render Land Polygons */}
        <G>
          {pathsData.map((item) => {
            const isSelected =
              Boolean(selectedMunicipality) &&
              (normalizeLguName(selectedMunicipality || '') === item.normalizedName ||
                item.rawName.toLowerCase() === (selectedMunicipality || '').toLowerCase());

            const fillColor = isSelected ? '#1f3d3c' : '#dceae8';
            const strokeColor = isSelected ? '#0f2423' : '#b2d4cf';
            const strokeWidth = isSelected ? 2 : 0.75;

            return (
              <Path
                key={item.rawName}
                testID={`muni-path-${item.rawName}`}
                d={item.d}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                onPress={() => onSelectMunicipality?.(item.normalizedName)}
              />
            );
          })}
        </G>

        {/* Render Glowing Project Pins */}
        <G>
          {renderedPins.map((pin) => {
            const isSelected = selectedPinId === pin.id;
            const coreColor = pin.tone === 'warning' ? '#f59e0b' : '#10b981';
            const glowColor =
              pin.tone === 'warning'
                ? 'rgba(245, 158, 11, 0.4)'
                : 'rgba(16, 185, 129, 0.4)';

            return (
              <G
                key={pin.id}
                testID={`map-pin-${pin.id}`}
                onPress={() => onSelectPin?.(pin)}
              >
                {/* Outer Glow Circle */}
                <Circle
                  cx={pin.x}
                  cy={pin.y}
                  r={isSelected ? 14 : 9}
                  fill={glowColor}
                />
                {/* Pin Core */}
                <Circle
                  cx={pin.x}
                  cy={pin.y}
                  r={isSelected ? 6 : 4}
                  fill={coreColor}
                  stroke="#ffffff"
                  strokeWidth={1.5}
                />
              </G>
            );
          })}
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#cbe3df', // Water background matching Website theme
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
