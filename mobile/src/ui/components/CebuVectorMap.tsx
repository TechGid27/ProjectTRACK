import React, {
  useMemo,
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  memo,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  PanResponder,
  Animated,
} from 'react-native';
import Svg, { Path, G, Circle, Text as SvgText } from 'react-native-svg';
import {
  Pin,
  MunicipalityCollection,
  HierarchyFilterTier,
  LguMeta,
} from '../../core/types';
import {
  computeBoundingBox,
  geoToSvgCoordinates,
  normalizeLguName,
  clusterPins,
  formatCurrencyPHP,
  getLguClassification,
  isLguInHierarchyTier,
  RegionPreset,
  computeMapViewBox,
} from '../../core/geoUtils';
import { haptics } from '../../services/haptics';
import cebuDataRaw from '../../assets/cebuMunicipalities.json';

const cebuData = cebuDataRaw as unknown as MunicipalityCollection;

const MIN_SCALE = 0.7;
const MAX_SCALE = 12.0;

export interface CebuVectorMapProps {
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

export interface CebuVectorMapRef {
  animateToCoordinates: (lat: number, lng: number, zoom?: number) => void;
  recenter: () => void;
  focusPreset?: (preset: RegionPreset) => void;
  zoomToLgu?: (lguName: string) => void;
}

interface PathDataItem {
  rawName: string;
  normalizedName: string;
  meta: LguMeta;
  d: string;
  centroid: { x: number; y: number };
  rings: { x: number; y: number }[][];
}

/**
 * Standard ray-casting point-in-polygon algorithm for SVG map geometry.
 */
function isPointInRing(x: number, y: number, ring: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].x;
    const yi = ring[i].y;
    const xj = ring[j].x;
    const yj = ring[j].y;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// ============================================================================
// MEMOIZED LAYER 1: 53 Cebu LGUs (HUCs, Component Cities, Municipalities)
// ============================================================================
interface MunicipalitiesLayerProps {
  pathsData: PathDataItem[];
  selectedMunicipality?: string | null;
  hierarchyTier?: HierarchyFilterTier;
  strokeWidthBase: number;
  onSelectMunicipality?: (name: string) => void;
}

const MunicipalitiesLayer = memo(function MunicipalitiesLayer({
  pathsData,
  selectedMunicipality,
  hierarchyTier = 'ALL',
  strokeWidthBase,
  onSelectMunicipality,
}: MunicipalitiesLayerProps) {
  const normSelected = useMemo(
    () => (selectedMunicipality ? normalizeLguName(selectedMunicipality).toLowerCase() : null),
    [selectedMunicipality],
  );

  return (
    <G>
      {pathsData.map((item) => {
        const isSelected =
          Boolean(normSelected) &&
          (normSelected === item.normalizedName.toLowerCase() ||
            normSelected === item.rawName.toLowerCase());

        const matchesTier = isLguInHierarchyTier(item.rawName, hierarchyTier);

        // Classification-based coloring
        let baseFill = '#dceae8';
        let baseStroke = '#b2d4cf';
        let strokeMultiplier = 1.0;

        if (item.meta.type === 'HUC') {
          // Highly Urbanized Cities (Cebu City, Mandaue City, Lapu-Lapu City)
          baseFill = '#194a44';
          baseStroke = '#f59e0b'; // Royal amber accent
          strokeMultiplier = 1.8;
        } else if (item.meta.type === 'COMPONENT_CITY') {
          // Component Cities (Bogo, Carcar, Danao, Naga, Talisay, Toledo)
          baseFill = '#245952';
          baseStroke = '#38bdf8'; // Bright civic cyan
          strokeMultiplier = 1.4;
        } else {
          // 44 Municipalities
          baseFill = '#dceae8';
          baseStroke = '#b2d4cf';
        }

        // Selected state takes absolute visual priority (keeps exact '#1f3d3c' for tests)
        const fillColor = isSelected ? '#1f3d3c' : baseFill;
        const strokeColor = isSelected ? '#0f2423' : baseStroke;
        const strokeWidth = isSelected
          ? strokeWidthBase * 2.8
          : strokeWidthBase * strokeMultiplier;

        const opacity = matchesTier || isSelected ? 1.0 : 0.42;

        return (
          <Path
            key={item.rawName}
            testID={`muni-path-${item.rawName}`}
            d={item.d}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            opacity={opacity}
            onPress={() => {
              haptics.triggerSelection();
              onSelectMunicipality?.(item.normalizedName);
            }}
          />
        );
      })}
    </G>
  );
});

// ============================================================================
// MEMOIZED LAYER 2: Place & Administrative Navigation Labels
// ============================================================================
interface PlaceLabelsLayerProps {
  pathsData: PathDataItem[];
  scale: number;
  hierarchyTier?: HierarchyFilterTier;
}

const PlaceLabelsLayer = memo(function PlaceLabelsLayer({
  pathsData,
  scale,
  hierarchyTier = 'ALL',
}: PlaceLabelsLayerProps) {
  // Cities show earlier at scale >= 1.25, Municipalities at scale >= 1.6
  if (scale < 1.25) return null;

  const fontSize = Math.max(7.0, 9.5 / Math.pow(scale, 0.25)) / scale;

  return (
    <>
      <G pointerEvents="none">
        {pathsData.map((item) => {
          const isCity =
            item.meta.type === 'HUC' || item.meta.type === 'COMPONENT_CITY';

          if (!isCity && scale < 1.6 && hierarchyTier !== 'MUNICIPALITIES') {
            return null;
          }

          const labelColor = isCity ? '#064e3b' : '#132c2a';
          const prefix =
            item.meta.type === 'HUC'
              ? '👑 '
              : item.meta.type === 'COMPONENT_CITY'
              ? '🏢 '
              : '';

          return (
            <SvgText
              key={`label-${item.rawName}`}
              x={item.centroid.x}
              y={item.centroid.y}
              fill={labelColor}
              opacity={0.8}
              fontSize={fontSize}
              fontWeight={isCity ? '900' : '700'}
              textAnchor="middle"
            >
              {`${prefix}${item.normalizedName}`}
            </SvgText>
          );
        })}
      </G>
      <View
        style={{
          position: 'absolute',
          width: 0,
          height: 0,
          opacity: 0,
          pointerEvents: 'none',
        }}
      >
        {pathsData.map((item) => (
          <Text key={`lbl-text-${item.rawName}`}>{item.normalizedName}</Text>
        ))}
      </View>
    </>
  );
});

// ============================================================================
// MEMOIZED LAYER 3: Project Pins & Density Clusters
// ============================================================================
interface PinsLayerProps {
  clusters: ReturnType<typeof clusterPins>;
  pins: Pin[];
  scale: number;
  selectedPinId?: string | null;
  onSelectPin?: (pin: Pin) => void;
  onClusterPress?: () => void;
}

const PinsLayer = memo(function PinsLayer({
  clusters,
  pins,
  scale,
  selectedPinId,
  onSelectPin,
  onClusterPress,
}: PinsLayerProps) {
  const screenClusterR = Math.max(9.0, 14.0 / Math.pow(scale, 0.28));
  const clusterR = screenClusterR / scale;
  const clusterFontSize = Math.max(7.0, 11 / Math.pow(scale, 0.28)) / scale;

  return (
    <G>
      {clusters.map((item) => {
        if (item.isCluster) {
          return (
            <G
              key={item.id}
              testID={`map-cluster-${item.count}`}
              onPress={() => {
                haptics.triggerSelection();
                onClusterPress?.();
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
                fontSize={clusterFontSize}
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
          reportCount > 0 || pin.tone === 'hotspot' || Boolean(pin.is_hotspot);

        const isCompleted = pin.status === 'Completed';
        const isDelayed = pin.status === 'Delayed' || pin.tone === 'warning';

        const coreColor = isHotspot
          ? '#ef4444'
          : isDelayed
          ? '#f59e0b'
          : isCompleted
          ? '#0284c7'
          : '#10b981';

        const glowColor = isHotspot
          ? 'rgba(239, 68, 68, 0.45)'
          : isDelayed
          ? 'rgba(245, 158, 11, 0.45)'
          : isCompleted
          ? 'rgba(2, 132, 199, 0.45)'
          : 'rgba(16, 185, 129, 0.45)';

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
            <Circle cx={pin.x} cy={pin.y} r={hitR} fill="transparent" />

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

            <Circle cx={pin.x} cy={pin.y} r={glowR} fill={glowColor} />

            <Circle
              cx={pin.x}
              cy={pin.y}
              r={coreR}
              fill={coreColor}
              stroke="#ffffff"
              strokeWidth={strokeW}
            />

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
  );
});

// ============================================================================
// MAIN CEBU VECTOR MAP COMPONENT (HARDWARE ACCELERATED 60-120 FPS)
// ============================================================================
function CebuVectorMapImpl(
  {
    selectedMunicipality,
    selectedPinId,
    hierarchyTier = 'ALL',
    pins = [],
    onSelectMunicipality,
    onSelectPin,
    width: propWidth,
    height: propHeight,
    testID = 'cebu-vector-map',
  }: CebuVectorMapProps,
  ref: any,
) {
  const windowDims = useWindowDimensions();

  const width = Math.max(280, propWidth ?? windowDims?.width ?? 360);
  const height = Math.max(
    280,
    propHeight ?? (windowDims?.height ? windowDims.height * 0.65 : 480),
  );

  const [scale, setScale] = useState(1.0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const scaleAnim = useRef(new Animated.Value(1.0)).current;

  const scaleRef = useRef(1.0);
  const offsetRef = useRef({ x: 0, y: 0 });
  const startOffset = useRef({ x: 0, y: 0 });
  const initialDistance = useRef<number | null>(null);
  const initialScale = useRef(1.0);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const touchStartRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const wasDoubleTapRef = useRef<boolean>(false);

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

        Animated.parallel([
          Animated.spring(pan, {
            toValue: { x: targetX, y: targetY },
            useNativeDriver: true,
            bounciness: 0,
          }),
          Animated.spring(scaleAnim, {
            toValue: targetScale,
            useNativeDriver: true,
            bounciness: 0,
          }),
        ]).start();
      },
      recenter: () => {
        handleReset();
      },
      focusPreset: (preset: RegionPreset) => {
        const pt = geoToSvgCoordinates(preset.lng, preset.lat, bounds, width, height, 16);
        const targetScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, preset.zoom));
        const targetX = (width / 2 - pt.x) * targetScale;
        const targetY = (height / 2 - pt.y) * targetScale;

        scaleRef.current = targetScale;
        offsetRef.current = { x: targetX, y: targetY };
        setScale(targetScale);
        setOffset({ x: targetX, y: targetY });

        Animated.parallel([
          Animated.timing(pan, {
            toValue: { x: targetX, y: targetY },
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: targetScale,
            duration: 250,
            useNativeDriver: true,
          }),
        ]).start();
      },
      zoomToLgu: (lguName: string) => {
        const normTarget = normalizeLguName(lguName).toLowerCase();
        const targetFeature = (cebuData?.features || []).find(
          (f: any) => normalizeLguName(f.properties?.name || '').toLowerCase() === normTarget,
        );

        if (targetFeature) {
          const box = computeBoundingBox([targetFeature]);
          if (box.minLng !== Infinity && box.maxLng !== -Infinity) {
            const centerLng = (box.minLng + box.maxLng) / 2;
            const centerLat = (box.minLat + box.maxLat) / 2;
            const centerPt = geoToSvgCoordinates(centerLng, centerLat, bounds, width, height, 16);

            const zoomScale = 3.5;
            const targetX = (width / 2 - centerPt.x) * zoomScale;
            const targetY = (height / 2 - centerPt.y) * zoomScale;

            scaleRef.current = zoomScale;
            offsetRef.current = { x: targetX, y: targetY };
            setScale(zoomScale);
            setOffset({ x: targetX, y: targetY });

            Animated.parallel([
              Animated.spring(pan, {
                toValue: { x: targetX, y: targetY },
                useNativeDriver: true,
                bounciness: 0,
              }),
              Animated.spring(scaleAnim, {
                toValue: zoomScale,
                useNativeDriver: true,
                bounciness: 0,
              }),
            ]).start();
          }
        }
      },
    }),
    [bounds, width, height],
  );

  // Auto-zoom to selected municipality
  useEffect(() => {
    if (!selectedMunicipality) {
      scaleRef.current = 1.0;
      offsetRef.current = { x: 0, y: 0 };
      pan.setValue({ x: 0, y: 0 });
      scaleAnim.setValue(1.0);
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

        Animated.parallel([
          Animated.timing(pan, {
            toValue: { x: targetX, y: targetY },
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: zoomScale,
            duration: 250,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }
  }, [selectedMunicipality, bounds, width, height]);

  // Build SVG path commands, centroids, rings, and classification metadata for all 53 LGUs
  const pathsData: PathDataItem[] = useMemo(() => {
    return (cebuData?.features || []).map((feature) => {
      const name = feature.properties.name;
      const normalized = normalizeLguName(name);
      const meta = getLguClassification(name);
      let d = '';
      const rings: { x: number; y: number }[][] = [];

      function ringToPath(ring: number[][]) {
        let subPath = '';
        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i < ring.length; i++) {
          const pt = geoToSvgCoordinates(
            ring[i][0],
            ring[i][1],
            bounds,
            width,
            height,
            16,
          );
          pts.push(pt);
          subPath += (i === 0 ? 'M ' : ' L ') + `${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
        }
        rings.push(pts);
        return subPath + ' Z ';
      }

      if (feature.geometry.type === 'Polygon') {
        const polyRings = feature.geometry.coordinates as number[][][];
        for (const ring of polyRings) {
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

      const box = computeBoundingBox([feature]);
      const centerLng = (box.minLng + box.maxLng) / 2;
      const centerLat = (box.minLat + box.maxLat) / 2;
      const centroid = geoToSvgCoordinates(centerLng, centerLat, bounds, width, height, 16);

      return {
        rawName: name,
        normalizedName: normalized,
        meta,
        d,
        centroid,
        rings,
      };
    });
  }, [bounds, width, height]);

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

  const steppedClusterScale = Math.round(scale * 4) / 4;
  const displayPinClusters = useMemo(() => {
    return clusterPins(basePins, steppedClusterScale, 24);
  }, [basePins, steppedClusterScale]);

  const activeSelectedPin = useMemo(() => {
    if (!selectedPinId) return null;
    return basePins.find((p) => p.id === selectedPinId) || null;
  }, [selectedPinId, basePins]);

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

  // Zoom/pan driven by the SVG viewBox so react-native-svg re-rasterizes vectors
  // crisply at every zoom level (no raster magnification = no blur). Derived to
  // match the existing screen<->SVG mapping:
  //   screenX = width/2 + (svgX - width/2) * scale + offset.x
  // Inverting for the viewBox: visible size = canvas / scale, origin offset so
  // the same geometry lands on the same screen pixels as before.
  const viewBox = useMemo(() => {
    return computeMapViewBox(scale, offset.x, offset.y, width, height);
  }, [scale, offset, width, height]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return (
            Math.abs(gestureState.dx) > 10 ||
            Math.abs(gestureState.dy) > 10 ||
            gestureState.numberActiveTouches === 2
          );
        },
        onMoveShouldSetPanResponderCapture: () => false,
        onPanResponderGrant: (evt) => {
          startOffset.current = { ...offsetRef.current };
          touchStartRef.current = {
            time: Date.now(),
            x: evt.nativeEvent.locationX,
            y: evt.nativeEvent.locationY,
          };
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

              Animated.parallel([
                Animated.timing(pan, {
                  toValue: { x: targetX, y: targetY },
                  duration: 200,
                  useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                  toValue: targetScale,
                  duration: 200,
                  useNativeDriver: true,
                }),
              ]).start(() => {
                setScale(targetScale);
                setOffset({ x: targetX, y: targetY });
              });

              lastTapRef.current = null;
              wasDoubleTapRef.current = true;
              return;
            }
            wasDoubleTapRef.current = false;
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
            scaleAnim.setValue(nextScale);
            // Commit live so the SVG viewBox re-rasterizes crisply at the new zoom.
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
            pan.setValue({ x: nextX, y: nextY });
            // Commit live so the viewBox pans with the gesture.
            setOffset({ x: nextX, y: nextY });
          }
        },
        onPanResponderRelease: (evt, gestureState) => {
          initialDistance.current = null;
          setOffset({ ...offsetRef.current });
          setScale(scaleRef.current);

          if (wasDoubleTapRef.current) {
            wasDoubleTapRef.current = false;
            return;
          }

          const touchDuration = touchStartRef.current ? Date.now() - touchStartRef.current.time : 999;
          const isTap =
            Math.abs(gestureState.dx) < 12 &&
            Math.abs(gestureState.dy) < 12 &&
            touchDuration < 380;

          if (!isTap) return;

          const touchX = evt.nativeEvent.locationX;
          const touchY = evt.nativeEvent.locationY;

          // Convert screen touch coordinates to map SVG space
          const svgX = (touchX - offsetRef.current.x - width / 2) / scaleRef.current + width / 2;
          const svgY = (touchY - offsetRef.current.y - height / 2) / scaleRef.current + height / 2;

          // 1. Hit-test Project Pins
          let closestPin: (typeof basePins)[0] | null = null;
          let minPinDist = Infinity;
          for (const pin of basePins) {
            const screenDist = Math.hypot(pin.x - svgX, pin.y - svgY) * scaleRef.current;
            if (screenDist < minPinDist) {
              minPinDist = screenDist;
              closestPin = pin;
            }
          }

          // If tapped within 32px of a pin on mobile screen
          if (closestPin && minPinDist <= 32) {
            haptics.triggerSelection();
            const fullPin = pins.find((p) => p.id === closestPin!.id) || closestPin;
            onSelectPin?.(fullPin);
            return;
          }

          // 2. Hit-test Municipality Boundaries & Centroids
          let tappedMuni: PathDataItem | null = null;

          // Exact polygon ring hit test
          for (const item of pathsData) {
            if (item.rings) {
              for (const ring of item.rings) {
                if (isPointInRing(svgX, svgY, ring)) {
                  tappedMuni = item;
                  break;
                }
              }
              if (tappedMuni) break;
            }
          }

          // Fallback: closest centroid if tapped near coast/border
          if (!tappedMuni) {
            let minCentroidDist = Infinity;
            for (const item of pathsData) {
              const screenDist = Math.hypot(item.centroid.x - svgX, item.centroid.y - svgY) * scaleRef.current;
              if (screenDist < minCentroidDist) {
                minCentroidDist = screenDist;
                tappedMuni = item;
              }
            }
            if (minCentroidDist > 55) {
              tappedMuni = null;
            }
          }

          if (tappedMuni) {
            haptics.triggerSelection();
            onSelectMunicipality?.(tappedMuni.normalizedName);
          }
        },
      }),
    [width, height, pan, scaleAnim, basePins, pathsData, pins, onSelectPin, onSelectMunicipality],
  );

  const handleZoomIn = () => {
    haptics.triggerLightImpact();
    const next = Math.min(MAX_SCALE, Number((scaleRef.current + 0.75).toFixed(2)));
    scaleRef.current = next;
    setScale(next);

    Animated.timing(scaleAnim, {
      toValue: next,
      duration: 180,
      useNativeDriver: true,
    }).start();
  };

  const handleZoomOut = () => {
    haptics.triggerLightImpact();
    const next = Math.max(MIN_SCALE, Number((scaleRef.current - 0.75).toFixed(2)));
    scaleRef.current = next;
    setScale(next);

    Animated.timing(scaleAnim, {
      toValue: next,
      duration: 180,
      useNativeDriver: true,
    }).start();
  };

  const handleReset = () => {
    haptics.triggerLightImpact();
    scaleRef.current = 1.0;
    offsetRef.current = { x: 0, y: 0 };
    setScale(1.0);
    setOffset({ x: 0, y: 0 });

    Animated.parallel([
      Animated.timing(pan, {
        toValue: { x: 0, y: 0 },
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1.0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const strokeScale = Math.round(Math.sqrt(Math.max(1, scale)) * 2) / 2;
  const strokeWidthBase = 0.75 / strokeScale;

  const pinLguMeta = activeSelectedPin ? getLguClassification(activeSelectedPin.lgu) : null;

  return (
    <View style={[styles.container, { width, height }]} testID={testID}>
      {/* Map touch surface for gestures & direct hit-testing */}
      <View
        style={StyleSheet.absoluteFill}
        testID="map-gesture-surface"
        {...panResponder.panHandlers}
      >
        {/* Vector layer: zoom & pan are driven by the SVG viewBox below, so
            react-native-svg re-rasterizes paths crisply at every zoom level. */}
        <View style={[styles.mapLayer, { width, height }]}>
          <Svg width={width} height={height} viewBox={viewBox} testID="map-svg-canvas">
            <G>
              {/* 53 Cebu LGUs with Administrative Distinction */}
              <MunicipalitiesLayer
                pathsData={pathsData}
                selectedMunicipality={selectedMunicipality}
                hierarchyTier={hierarchyTier}
                strokeWidthBase={strokeWidthBase}
                onSelectMunicipality={onSelectMunicipality}
              />

              {/* Place Navigation Labels with City Accents */}
              <PlaceLabelsLayer
                pathsData={pathsData}
                scale={scale}
                hierarchyTier={hierarchyTier}
              />

              {/* Project Pins & Density Clusters */}
              <PinsLayer
                clusters={displayPinClusters}
                pins={pins}
                scale={scale}
                selectedPinId={selectedPinId}
                onSelectPin={onSelectPin}
                onClusterPress={() => {
                  const nextScale = Math.min(
                    MAX_SCALE,
                    Number((scaleRef.current + 1.2).toFixed(2)),
                  );
                  scaleRef.current = nextScale;
                  Animated.timing(scaleAnim, {
                    toValue: nextScale,
                    duration: 200,
                    useNativeDriver: true,
                  }).start(() => {
                    setScale(nextScale);
                  });
                }}
              />
            </G>
          </Svg>
        </View>
      </View>

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
              {pinLguMeta?.type === 'HUC'
                ? '👑 '
                : pinLguMeta?.type === 'COMPONENT_CITY'
                ? '🏢 '
                : '📍 '}
              {activeSelectedPin.lgu}
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
        <View style={styles.zoomIndicator}>
          <Text style={styles.zoomIndicatorText} testID="zoom-level-badge">
            {scale.toFixed(1)}x
          </Text>
        </View>
      )}
    </View>
  );
}

const CebuVectorMap = forwardRef<CebuVectorMapRef, CebuVectorMapProps>(CebuVectorMapImpl);
export default CebuVectorMap;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#cbe3df',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
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
    width: 44,
    height: 44,
    borderRadius: 10,
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
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  calloutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  calloutStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusCompleted: {
    backgroundColor: 'rgba(2, 132, 199, 0.25)',
  },
  statusDelayed: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
  },
  statusOngoing: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
  },
  calloutStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  calloutLguText: {
    fontSize: 11,
    color: '#a3e635',
    fontWeight: '700',
    maxWidth: '55%',
  },
  calloutTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 16,
    marginBottom: 4,
  },
  calloutContractor: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 8,
  },
  calloutFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 6,
  },
  calloutBudget: {
    fontSize: 12,
    fontWeight: '800',
    color: '#38bdf8',
  },
  calloutActionBtn: {
    backgroundColor: '#14b8a6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  calloutActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f2423',
  },
});
