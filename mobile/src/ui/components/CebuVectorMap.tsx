import React, { useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  PanResponder,
} from 'react-native';
import Svg, { Path, G, Circle, Text as SvgText } from 'react-native-svg';
import { Pin, MunicipalityCollection } from '../../core/types';
import {
  computeBoundingBox,
  geoToSvgCoordinates,
  normalizeLguName,
  clusterPins,
} from '../../core/geoUtils';
import { haptics } from '../../services/haptics';
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

  // Pan & Zoom state
  const [scale, setScale] = useState(1.0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const scaleRef = useRef(1.0);
  const offsetRef = useRef({ x: 0, y: 0 });
  const startOffset = useRef({ x: 0, y: 0 });
  const initialDistance = useRef<number | null>(null);
  const initialScale = useRef(1.0);

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

  // 3.1 Density pin clustering for low zoom
  const displayPinClusters = useMemo(() => {
    return clusterPins(renderedPins, scale, 28);
  }, [renderedPins, scale]);

  // 4. Gesture responder for Drag & Pinch-to-zoom
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return (
            Math.abs(gestureState.dx) > 8 ||
            Math.abs(gestureState.dy) > 8 ||
            gestureState.numberActiveTouches === 2
          );
        },
        onMoveShouldSetPanResponderCapture: () => false,
        onPanResponderGrant: (evt) => {
          startOffset.current = { ...offsetRef.current };
          if (evt.nativeEvent.touches && evt.nativeEvent.touches.length === 2) {
            const [t1, t2] = evt.nativeEvent.touches;
            initialDistance.current = Math.hypot(
              t1.pageX - t2.pageX,
              t1.pageY - t2.pageY,
            );
            initialScale.current = scaleRef.current;
          } else {
            initialDistance.current = null;
          }
        },
        onPanResponderMove: (evt, gestureState) => {
          if (
            evt.nativeEvent.touches &&
            evt.nativeEvent.touches.length === 2 &&
            initialDistance.current
          ) {
            const [t1, t2] = evt.nativeEvent.touches;
            const currentDistance = Math.hypot(
              t1.pageX - t2.pageX,
              t1.pageY - t2.pageY,
            );
            const pinchRatio = currentDistance / initialDistance.current;
            const nextScale = Math.min(
              4.0,
              Math.max(0.7, Number((initialScale.current * pinchRatio).toFixed(2))),
            );
            scaleRef.current = nextScale;
            setScale(nextScale);
          } else if (!evt.nativeEvent.touches || evt.nativeEvent.touches.length <= 1) {
            const maxPan = width * scaleRef.current * 0.8;
            const nextX = Math.min(maxPan, Math.max(-maxPan, startOffset.current.x + gestureState.dx));
            const nextY = Math.min(maxPan, Math.max(-maxPan, startOffset.current.y + gestureState.dy));
            offsetRef.current = { x: nextX, y: nextY };
            setOffset({ x: nextX, y: nextY });
          }
        },
        onPanResponderRelease: () => {
          initialDistance.current = null;
        },
      }),
    [width],
  );

  const handleZoomIn = () => {
    haptics.triggerLightImpact();
    const next = Math.min(4.0, Number((scaleRef.current + 0.35).toFixed(2)));
    scaleRef.current = next;
    setScale(next);
  };

  const handleZoomOut = () => {
    haptics.triggerLightImpact();
    const next = Math.max(0.7, Number((scaleRef.current - 0.35).toFixed(2)));
    scaleRef.current = next;
    setScale(next);
  };

  const handleReset = () => {
    haptics.triggerLightImpact();
    scaleRef.current = 1.0;
    offsetRef.current = { x: 0, y: 0 };
    setScale(1.0);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <View
      style={[styles.container, { width, height }]}
      testID="cebu-vector-map"
      {...panResponder.panHandlers}
    >
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <G
          originX={width / 2}
          originY={height / 2}
          scale={scale}
          x={offset.x}
          y={offset.y}
        >
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
                  onPress={() => {
                    haptics.triggerSelection();
                    onSelectMunicipality?.(item.normalizedName);
                  }}
                />
              );
            })}
          </G>

          {/* Render Project Pins & Density Clusters */}
          <G>
            {displayPinClusters.map((item) => {
              if (item.isCluster) {
                return (
                  <G
                    key={item.id}
                    testID={`map-cluster-${item.count}`}
                    onPress={() => {
                      haptics.triggerSelection();
                      const nextScale = Math.min(
                        4.0,
                        Number((scaleRef.current + 0.8).toFixed(2)),
                      );
                      scaleRef.current = nextScale;
                      setScale(nextScale);
                    }}
                  >
                    <Circle
                      cx={item.x}
                      cy={item.y}
                      r={14}
                      fill="#1f3d3c"
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                    <SvgText
                      x={item.x}
                      y={item.y + 4}
                      fill="#ffffff"
                      fontSize={11}
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {item.count}
                    </SvgText>
                  </G>
                );
              }

              const pin = item.pins[0];
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
                  onPress={() => {
                    haptics.triggerSelection();
                    const { x: _x, y: _y, ...originalPin } = pin;
                    onSelectPin?.(originalPin);
                  }}
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
        </G>
      </Svg>

      {/* Floating Zoom & Pan Controls */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity
          testID="zoom-in-btn"
          style={styles.controlBtn}
          onPress={handleZoomIn}
          activeOpacity={0.7}
          accessibilityLabel="Zoom In"
        >
          <Text style={styles.controlBtnText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="zoom-out-btn"
          style={styles.controlBtn}
          onPress={handleZoomOut}
          activeOpacity={0.7}
          accessibilityLabel="Zoom Out"
        >
          <Text style={styles.controlBtnText}>−</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="zoom-reset-btn"
          style={[styles.controlBtn, styles.resetBtn]}
          onPress={handleReset}
          activeOpacity={0.7}
          accessibilityLabel="Reset View"
        >
          <Text style={styles.resetBtnText}>↺</Text>
        </TouchableOpacity>
      </View>

      {/* Zoom Level Indicator */}
      {scale !== 1.0 && (
        <View style={styles.zoomIndicator} testID="zoom-level-badge">
          <Text style={styles.zoomIndicatorText}>{scale.toFixed(1)}x</Text>
        </View>
      )}
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
  controlsContainer: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 10,
    gap: 4,
  },
  controlBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlBtnText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f3d3c',
    lineHeight: 22,
  },
  resetBtn: {
    backgroundColor: '#f1f5f9',
  },
  resetBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748b',
  },
  zoomIndicator: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    backgroundColor: 'rgba(31, 61, 60, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 10,
  },
  zoomIndicatorText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
});
