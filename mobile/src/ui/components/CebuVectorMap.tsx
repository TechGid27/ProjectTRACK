import React, { useMemo, useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  PanResponder,
  Platform,
} from 'react-native';
import Svg, { Path, G, Circle, Text as SvgText } from 'react-native-svg';
import { Pin, MunicipalityCollection } from '../../core/types';
import {
  computeBoundingBox,
  geoToSvgCoordinates,
  normalizeLguName,
  clusterPins,
  formatCurrencyPHP,
} from '../../core/geoUtils';
import { haptics } from '../../services/haptics';
import cebuDataRaw from '../../assets/cebuMunicipalities.json';

const cebuData = cebuDataRaw as unknown as MunicipalityCollection;

const MIN_SCALE = 0.7;
const MAX_SCALE = 12.0;

export interface CebuVectorMapProps {
  selectedMunicipality?: string | null;
  selectedPinId?: string | null;
  pins?: Pin[];
  onSelectMunicipality?: (name: string) => void;
  onSelectPin?: (pin: Pin) => void;
  width?: number;
  height?: number;
  testID?: string;
}

export interface CebuVectorMapRef {
  animateToCoordinates: (lat: number, lng: number, zoom?: number) => void;
  recenter: () => void;
}

function CebuVectorMapImpl({
  selectedMunicipality,
  selectedPinId,
  pins = [],
  onSelectMunicipality,
  onSelectPin,
  width: propWidth,
  height: propHeight,
  testID = 'cebu-vector-map',
}: CebuVectorMapProps, ref: any) {
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
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);

  // 1. Calculate map bounds once
  const bounds = useMemo(() => computeBoundingBox(cebuData?.features || []), []);

  useImperativeHandle(
    ref,
    () => ({
      animateToCoordinates: (lat: number, lng: number, zoom = 3.5) => {
        const pt = geoToSvgCoordinates(lng, lat, bounds, width, height, 16);
        const targetScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, zoom));
        const targetX = (width / 2 - pt.x) * targetScale;
        const targetY = (height / 2 - pt.y) * targetScale;
        scaleRef.current = targetScale;
        offsetRef.current = { x: targetX, y: targetY };
        setScale(targetScale);
        setOffset({ x: targetX, y: targetY });
      },
      recenter: () => {
        handleReset();
      },
    }),
    [bounds, width, height],
  );

  // Auto-zoom to selected municipality
  useEffect(() => {
    if (!selectedMunicipality) {
      scaleRef.current = 1.0;
      offsetRef.current = { x: 0, y: 0 };
      setScale(1.0);
      setOffset({ x: 0, y: 0 });
      return;
    }

    const normTarget = normalizeLguName(selectedMunicipality).toLowerCase();
    const targetFeature = (cebuData?.features || []).find(
      (f: any) => normalizeLguName(f.properties?.name || '').toLowerCase() === normTarget,
    );

    if (targetFeature) {
      const box = computeBoundingBox([targetFeature]);
      if (box.minLng !== Infinity && box.maxLng !== -Infinity) {
        const centerLng = (box.minLng + box.maxLng) / 2;
        const centerLat = (box.minLat + box.maxLat) / 2;
        const centerPt = geoToSvgCoordinates(centerLng, centerLat, bounds, width, height, 16);

        const zoomScale = 3.2;
        const targetX = (width / 2 - centerPt.x) * zoomScale;
        const targetY = (height / 2 - centerPt.y) * zoomScale;

        scaleRef.current = zoomScale;
        offsetRef.current = { x: targetX, y: targetY };
        setScale(zoomScale);
        setOffset({ x: targetX, y: targetY });
      }
    }
  }, [selectedMunicipality, bounds, width, height]);

  // 2. Build SVG path commands and centroids for all municipalities
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

      // Compute centroid for place navigation label
      const box = computeBoundingBox([feature]);
      const centerLng = (box.minLng + box.maxLng) / 2;
      const centerLat = (box.minLat + box.maxLat) / 2;
      const centroid = geoToSvgCoordinates(centerLng, centerLat, bounds, width, height, 16);

      return {
        rawName: name,
        normalizedName: normalized,
        d,
        centroid,
      };
    });
  }, [bounds, width, height]);

  // 3. Precalculate authentic pin coordinates directly from GPS lat/lng
  const basePins = useMemo(() => {
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

  // 3.1 Density pin clustering for low zoom (preserves true coordinates when unclustered)
  const displayPinClusters = useMemo(() => {
    return clusterPins(basePins, scale, 24);
  }, [basePins, scale]);

  // Active selected pin for floating callout card
  const activeSelectedPin = useMemo(() => {
    if (!selectedPinId) return null;
    return basePins.find((p) => p.id === selectedPinId) || null;
  }, [selectedPinId, basePins]);

  // Calculate screen position for interactive callout
  const calloutPosition = useMemo(() => {
    if (!activeSelectedPin) return null;
    const screenX = width / 2 + (activeSelectedPin.x - width / 2) * scale + offset.x;
    const screenY = height / 2 + (activeSelectedPin.y - height / 2) * scale + offset.y;

    const cardW = Math.min(270, width - 36);
    const left = Math.min(Math.max(16, screenX - cardW / 2), width - cardW - 16);
    const top = screenY > 160 ? screenY - 130 : screenY + 24;

    const visible =
      screenX > -60 && screenX < width + 60 && screenY > -60 && screenY < height + 60;

    return { left, top, width: cardW, visible };
  }, [activeSelectedPin, scale, offset, width, height]);

  // 4. Gesture responder for Drag & Pinch-to-zoom (up to 12.0x)
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
          const now = Date.now();
          if (evt.nativeEvent.touches && evt.nativeEvent.touches.length === 2) {
            const [t1, t2] = evt.nativeEvent.touches;
            initialDistance.current = Math.hypot(
              t1.pageX - t2.pageX,
              t1.pageY - t2.pageY,
            );
            initialScale.current = scaleRef.current;
          } else {
            initialDistance.current = null;
            // Double-tap zoom detection
            const touch = evt.nativeEvent;
            if (
              lastTapRef.current &&
              now - lastTapRef.current.time < 320 &&
              Math.hypot(
                touch.locationX - lastTapRef.current.x,
                touch.locationY - lastTapRef.current.y,
              ) < 36
            ) {
              haptics.triggerLightImpact();
              const targetScale = Math.min(
                MAX_SCALE,
                Number((scaleRef.current * 1.8).toFixed(2)),
              );
              const targetX = (width / 2 - touch.locationX) * (targetScale / scaleRef.current);
              const targetY = (height / 2 - touch.locationY) * (targetScale / scaleRef.current);
              scaleRef.current = targetScale;
              offsetRef.current = { x: targetX, y: targetY };
              setScale(targetScale);
              setOffset({ x: targetX, y: targetY });
              lastTapRef.current = null;
              return;
            }
            lastTapRef.current = {
              time: now,
              x: touch.locationX,
              y: touch.locationY,
            };
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
              MAX_SCALE,
              Math.max(MIN_SCALE, Number((initialScale.current * pinchRatio).toFixed(2))),
            );
            scaleRef.current = nextScale;
            setScale(nextScale);
          } else if (!evt.nativeEvent.touches || evt.nativeEvent.touches.length <= 1) {
            const maxPanX = width * scaleRef.current * 1.2;
            const maxPanY = height * scaleRef.current * 1.6;
            const nextX = Math.min(
              maxPanX,
              Math.max(-maxPanX, startOffset.current.x + gestureState.dx),
            );
            const nextY = Math.min(
              maxPanY,
              Math.max(-maxPanY, startOffset.current.y + gestureState.dy),
            );
            offsetRef.current = { x: nextX, y: nextY };
            setOffset({ x: nextX, y: nextY });
          }
        },
        onPanResponderRelease: () => {
          initialDistance.current = null;
        },
      }),
    [width, height],
  );

  const handleZoomIn = () => {
    haptics.triggerLightImpact();
    const next = Math.min(MAX_SCALE, Number((scaleRef.current + 0.75).toFixed(2)));
    scaleRef.current = next;
    setScale(next);
  };

  const handleZoomOut = () => {
    haptics.triggerLightImpact();
    const next = Math.max(MIN_SCALE, Number((scaleRef.current - 0.75).toFixed(2)));
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

  // Scale compensation factor so pins remain crisp and compact at 12.0x zoom
    const strokeScale = Math.sqrt(Math.max(1, scale));

  return (
    <View
      style={[styles.container, { width, height }]}
      testID={testID}
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
              const strokeWidth = (isSelected ? 2 : 0.75) / strokeScale;

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

          {/* Place & Municipality Navigation Labels (Visible on Zoom scale >= 1.6) */}
          {scale >= 1.6 && (
            <>
              <G pointerEvents="none">
                {pathsData.map((item) => (
                  <SvgText
                    key={`label-${item.rawName}`}
                    x={item.centroid.x}
                    y={item.centroid.y}
                    fill="#132c2a"
                    opacity={0.65}
                    fontSize={Math.max(8.5, 12 / strokeScale)}
                    fontWeight="800"
                    textAnchor="middle"
                  >
                    {item.normalizedName}
                  </SvgText>
                ))}
              </G>
              <View style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}>
                {pathsData.map((item) => (
                  <Text key={`lbl-text-${item.rawName}`}>{item.normalizedName}</Text>
                ))}
              </View>
            </>
          )}

          {/* Render Project Pins & Density Clusters with Responsive Status Colors */}
          <G>
            {displayPinClusters.map((item) => {
              if (item.isCluster) {
                const screenClusterR = Math.max(9.0, 14.0 / Math.pow(scale, 0.28));
                const clusterR = screenClusterR / scale;
                return (
                  <G
                    key={item.id}
                    testID={`map-cluster-${item.count}`}
                    onPress={() => {
                      haptics.triggerSelection();
                      const nextScale = Math.min(
                        MAX_SCALE,
                        Number((scaleRef.current + 1.2).toFixed(2)),
                      );
                      scaleRef.current = nextScale;
                      setScale(nextScale);
                    }}
                  >
                    <Circle
                      cx={item.x}
                      cy={item.y}
                      r={clusterR}
                      fill="#1f3d3c"
                      stroke="#ffffff"
                      strokeWidth={1.5 / scale}
                    />
                    <SvgText
                      x={item.x}
                      y={item.y + 3.5 / scale}
                      fill="#ffffff"
                      fontSize={Math.max(7.0, 11 / Math.pow(scale, 0.28)) / scale}
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
              const reportCount = typeof pin.report_count === 'number' ? pin.report_count : 0;
              const isHotspot =
                reportCount > 0 ||
                pin.tone === 'hotspot' ||
                Boolean(pin.is_hotspot);

              // Responsive status color mapping
              const isCompleted = pin.status === 'Completed';
              const isDelayed = pin.status === 'Delayed' || pin.tone === 'warning';

              const coreColor = isHotspot
                ? '#ef4444' // Red Hotspot
                : isDelayed
                ? '#f59e0b' // Amber Delayed
                : isCompleted
                ? '#0284c7' // Blue Completed
                : '#10b981'; // Emerald Ongoing

              const glowColor = isHotspot
                ? 'rgba(239, 68, 68, 0.45)'
                : isDelayed
                ? 'rgba(245, 158, 11, 0.45)'
                : isCompleted
                ? 'rgba(2, 132, 199, 0.45)'
                : 'rgba(16, 185, 129, 0.45)';

              // Screen size decreases as user zooms in so dots become smaller and pinpoint
              const screenCoreR = Math.max(2.0, (isSelected ? 6.5 : 4.8) / Math.pow(scale, 0.38));
              const screenGlowR = Math.max(3.8, (isSelected ? 12.0 : 8.5) / Math.pow(scale, 0.38));
              const screenRadarR = Math.max(5.5, (isSelected ? 16.0 : 12.0) / Math.pow(scale, 0.38));

              const coreR = screenCoreR / scale;
              const glowR = screenGlowR / scale;
              const radarR = screenRadarR / scale;
              const hitR = Math.max(18 / scale, coreR * 2.5);
              const strokeW = (isSelected ? 1.5 : 1.0) / scale;

              return (
                <G
                  key={pin.id}
                  testID={`map-pin-${pin.id}`}
                  onPress={() => {
                    haptics.triggerSelection();
                    onSelectPin?.(pins.find((p) => p.id === pin.id) || pin);
                  }}
                >
                  {/* Invisible generous touch target */}
                  <Circle cx={pin.x} cy={pin.y} r={hitR} fill="transparent" />

                  {/* Concentric Hotspot Radar Rings */}
                  {isHotspot && (
                    <>
                      <Circle
                        cx={pin.x}
                        cy={pin.y}
                        r={radarR}
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth={strokeW}
                        strokeDasharray={`${2 / scale},${2 / scale}`}
                        opacity={0.85}
                      />
                      <Circle
                        cx={pin.x}
                        cy={pin.y}
                        r={glowR}
                        fill="rgba(239, 68, 68, 0.25)"
                      />
                    </>
                  )}

                  {/* Outer Glow Halo */}
                  <Circle
                    cx={pin.x}
                    cy={pin.y}
                    r={glowR}
                    fill={glowColor}
                  />

                  {/* Pin Core */}
                  <Circle
                    cx={pin.x}
                    cy={pin.y}
                    r={coreR}
                    fill={coreColor}
                    stroke="#ffffff"
                    strokeWidth={strokeW}
                  />

                  {/* Selected Ripple Pulse */}
                  {isSelected && (
                    <Circle
                      cx={pin.x}
                      cy={pin.y}
                      r={radarR + 2.5 / scale}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth={strokeW}
                      opacity={0.9}
                    />
                  )}
                </G>
              );
            })}
          </G>
        </G>
      </Svg>

      {/* Floating Interactive Callout Card on Selected Project Pin */}
      {activeSelectedPin && calloutPosition?.visible && (
        <View
          style={[
            styles.interactiveCallout,
            {
              left: calloutPosition.left,
              top: calloutPosition.top,
              width: calloutPosition.width,
            },
          ]}
          testID="map-pin-callout-card"
        >
          <View style={styles.calloutHeader}>
            <View
              style={[
                styles.calloutStatusPill,
                activeSelectedPin.status === 'Completed'
                  ? styles.statusCompleted
                  : activeSelectedPin.status === 'Delayed'
                  ? styles.statusDelayed
                  : styles.statusOngoing,
              ]}
            >
              <Text style={styles.calloutStatusText}>
                {activeSelectedPin.status || 'Ongoing'}
              </Text>
            </View>
            <Text style={styles.calloutLguText} numberOfLines={1}>
              📍 {activeSelectedPin.lgu}
            </Text>
          </View>

          <Text style={styles.calloutTitle} numberOfLines={2}>
            {activeSelectedPin.name}
          </Text>

          {activeSelectedPin.contractor && (
            <Text style={styles.calloutContractor} numberOfLines={1}>
              🏗️ {activeSelectedPin.contractor}
            </Text>
          )}

          <View style={styles.calloutFooter}>
            {typeof activeSelectedPin.budget === 'number' && (
              <Text style={styles.calloutBudget}>
                {formatCurrencyPHP(activeSelectedPin.budget).split('.')[0]}
              </Text>
            )}
            <TouchableOpacity
              style={styles.calloutActionBtn}
              onPress={() => {
                haptics.triggerSelection();
                onSelectPin?.(activeSelectedPin);
              }}
              activeOpacity={0.8}
              testID="callout-view-details-btn"
            >
              <Text style={styles.calloutActionText}>View Details →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Floating Zoom & Pan Controls (Up to 12.0x Google Maps Style) */}
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
        <View style={styles.zoomIndicator}>
          <Text style={styles.zoomIndicatorText} testID="zoom-level-badge">{scale.toFixed(1)}x</Text>
        </View>
      )}
    </View>
  );
}

const CebuVectorMap = forwardRef<CebuVectorMapRef, CebuVectorMapProps>(CebuVectorMapImpl);
export default CebuVectorMap;

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
    top: '50%',
    right: 14,
    transform: [{ translateY: -55 }],
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
    zIndex: 15,
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
    top: 14,
    right: 14,
    backgroundColor: 'rgba(31, 61, 60, 0.88)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  zoomIndicatorText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  interactiveCallout: {
    position: 'absolute',
    backgroundColor: '#1f3d3c',
    borderRadius: 14,
    padding: 12,
    zIndex: 40,
    borderWidth: 1,
    borderColor: '#34d399',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 8,
      },
    }),
  },
  calloutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  calloutStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  calloutStatusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusOngoing: {
    backgroundColor: '#ccfbf1',
    color: '#0f766e',
  },
  statusCompleted: {
    backgroundColor: '#d1fae5',
    color: '#065f46',
  },
  statusDelayed: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
  },
  calloutLguText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#99f6e4',
    flex: 1,
    textAlign: 'right',
  },
  calloutTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 16,
    marginBottom: 4,
  },
  calloutContractor: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 8,
  },
  calloutFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  calloutBudget: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#34d399',
  },
  calloutActionBtn: {
    backgroundColor: 'rgba(52, 211, 153, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#34d399',
  },
  calloutActionText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#34d399',
  },
});
