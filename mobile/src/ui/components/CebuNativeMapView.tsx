import React, { useRef, useState, useMemo, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Pin } from '../../core/types';
import { normalizeCoordinates, normalizeLguName } from '../../core/geoUtils';
import { ALL_BARANGAY_FEATURES } from '../../core/barangayData';
import cebuDataRaw from '../../assets/cebuMunicipalities.json';
import { haptics } from '../../services/haptics';

export interface CebuNativeMapViewProps {
  selectedMunicipality?: string | null;
  selectedPinId?: string | null;
  pins?: Pin[];
  onSelectMunicipality?: (name: string) => void;
  onSelectPin?: (pin: Pin) => void;
  width?: number;
  height?: number;
}

export interface CebuNativeMapViewRef {
  animateToCoordinates: (lat: number, lng: number, delta?: number) => void;
  recenter: () => void;
}

export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

const INITIAL_REGION: Region = {
  latitude: 10.3157,
  longitude: 123.8854,
  latitudeDelta: 1.8,
  longitudeDelta: 1.2,
};

let MapView: any = View;
let Marker: any = TouchableOpacity;
let Polygon: any = View;
try {
  const RNM = require('react-native-maps');
  MapView = RNM.default || RNM;
  Marker = RNM.Marker || TouchableOpacity;
  Polygon = RNM.Polygon || View;
} catch {
  MapView = forwardRef((props: any, ref: any) => {
    useImperativeHandle(ref, () => ({
      animateToRegion: (_r: any, _d?: number) => {},
    }));
    return <View testID={props.testID} {...props} />;
  });
  Marker = forwardRef((props: any, ref: any) => (
    <TouchableOpacity
      ref={ref}
      testID={props.testID}
      onPress={props.onPress}
      activeOpacity={0.8}
      {...props}
    >
      {props.children}
    </TouchableOpacity>
  ));
  Polygon = forwardRef((props: any, ref: any) => (
    <TouchableOpacity
      ref={ref}
      testID={props.testID}
      onPress={props.onPress}
      activeOpacity={0.8}
      {...props}
    />
  ));
}

// Subtle, clean civic map styling (matching Website's CartoDB Positron aesthetic)
const CIVIC_MAP_STYLE = [
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#cbe3df' }],
  },
  {
    featureType: 'landscape',
    elementType: 'geometry',
    stylers: [{ color: '#eef5f4' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#ffffff' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#fcd34d' }, { lightness: 40 }],
  },
  {
    featureType: 'poi',
    elementType: 'all',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit',
    elementType: 'all',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#162e2d' }],
  },
];

function extractPolygonCoordinates(geometry: any): Array<{ latitude: number; longitude: number }> {
  if (!geometry || !geometry.coordinates) return [];
  const coords = geometry.coordinates;
  // Handle Polygon vs MultiPolygon
  let ring: any[] = [];
  if (geometry.type === 'MultiPolygon' && Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
    ring = coords[0][0];
  } else if (geometry.type === 'Polygon' && Array.isArray(coords[0])) {
    ring = coords[0];
  } else if (Array.isArray(coords)) {
    ring = coords;
  }

  return ring
    .filter((c: any) => Array.isArray(c) && c.length >= 2 && typeof c[0] === 'number')
    .map((c: any) => ({
      latitude: c[1],
      longitude: c[0],
    }));
}

const CebuNativeMapView = forwardRef<CebuNativeMapViewRef, CebuNativeMapViewProps>(
  (
    {
      selectedMunicipality,
      selectedPinId,
      pins = [],
      onSelectMunicipality,
      onSelectPin,
      width,
      height,
    },
    ref,
  ) => {
    const mapRef = useRef<any>(null);
    const windowDims = useWindowDimensions();
    const mapWidth = width || windowDims.width || 360;
    const mapHeight = height || 500;

    const [currentRegion, setCurrentRegion] = useState<Region>(INITIAL_REGION);
    const [zoomLevel, setZoomLevel] = useState<number>(9);

    // Compute zoom level from region longitudeDelta
    const calculateZoom = useCallback((delta: number) => {
      const zoom = Math.round(Math.log(360 / Math.max(0.0001, delta)) / Math.LN2);
      return Math.max(7, Math.min(18, zoom));
    }, []);

    const handleRegionChangeComplete = useCallback(
      (region: Region) => {
        setCurrentRegion(region);
        setZoomLevel(calculateZoom(region.longitudeDelta));
      },
      [calculateZoom],
    );

    // Expose imperative methods for camera flight from Chatbot or parent screens
    useImperativeHandle(ref, () => ({
      animateToCoordinates: (lat: number, lng: number, delta = 0.06) => {
        mapRef.current?.animateToRegion?.(
          {
            latitude: lat,
            longitude: lng,
            latitudeDelta: delta,
            longitudeDelta: delta,
          },
          600,
        );
      },
      recenter: () => {
        mapRef.current?.animateToRegion?.(INITIAL_REGION, 600);
      },
    }));

    // Center-Right Zoom In (+)
    const handleZoomIn = () => {
      haptics.triggerLightImpact();
      const nextLatDelta = Math.max(0.005, currentRegion.latitudeDelta * 0.5);
      const nextLngDelta = Math.max(0.005, currentRegion.longitudeDelta * 0.5);
      mapRef.current?.animateToRegion?.(
        {
          ...currentRegion,
          latitudeDelta: nextLatDelta,
          longitudeDelta: nextLngDelta,
        },
        300,
      );
    };

    // Center-Right Zoom Out (−)
    const handleZoomOut = () => {
      haptics.triggerLightImpact();
      const nextLatDelta = Math.min(3.5, currentRegion.latitudeDelta * 2.0);
      const nextLngDelta = Math.min(2.5, currentRegion.longitudeDelta * 2.0);
      mapRef.current?.animateToRegion?.(
        {
          ...currentRegion,
          latitudeDelta: nextLatDelta,
          longitudeDelta: nextLngDelta,
        },
        300,
      );
    };

    // Center-Right Recenter (🎯)
    const handleRecenter = () => {
      haptics.triggerSelection();
      mapRef.current?.animateToRegion?.(INITIAL_REGION, 500);
    };

    // Animate to selected LGU center when selectedMunicipality changes
    useEffect(() => {
      if (!selectedMunicipality) return;
      const norm = normalizeLguName(selectedMunicipality).toLowerCase();
      const feature = cebuDataRaw?.features?.find(
        (f: any) => normalizeLguName(f.properties?.name || '').toLowerCase() === norm,
      );
      if (feature && (feature as any).properties?.center) {
        const center = (feature as any).properties.center;
        mapRef.current?.animateToRegion?.(
          {
            latitude: center.lat,
            longitude: center.lng,
            latitudeDelta: 0.12,
            longitudeDelta: 0.12,
          },
          600,
        );
      }
    }, [selectedMunicipality]);

    // 1. Validated & Normalized Pins (99% precision, zero sea water)
    const normalizedPins = useMemo(() => {
      return pins
        .map((p) => {
          const rawLat = typeof p.lat === 'number' ? p.lat : 10.3157;
          const rawLng = typeof p.lng === 'number' ? p.lng : 123.8854;
          const norm = normalizeCoordinates(rawLat, rawLng);
          if (norm.status === 'rejected') return null;

          return {
            ...p,
            lat: norm.lat,
            lng: norm.lng,
          };
        })
        .filter(Boolean) as Pin[];
    }, [pins]);

    // 2. Anti-Density Spatial Clustering: Groups pins within grid when zoomed out
    const clusteredPins = useMemo(() => {
      if (zoomLevel >= 12) {
        return normalizedPins.map((p) => ({
          type: 'single' as const,
          id: p.id,
          pin: p,
          lat: p.lat,
          lng: p.lng,
        }));
      }

      // Proximity threshold shrinks as zoom increases
      const clusterThreshold = 0.08 / Math.pow(1.5, Math.max(0, zoomLevel - 8));
      const clusters: Array<{
        type: 'cluster' | 'single';
        id: string;
        pins: Pin[];
        lat: number;
        lng: number;
        count: number;
      }> = [];

      const visited = new Set<string>();

      for (let i = 0; i < normalizedPins.length; i++) {
        const current = normalizedPins[i];
        if (visited.has(current.id)) continue;

        const group: Pin[] = [current];
        visited.add(current.id);

        for (let j = i + 1; j < normalizedPins.length; j++) {
          const other = normalizedPins[j];
          if (visited.has(other.id)) continue;

          const dLat = Math.abs(current.lat - other.lat);
          const dLng = Math.abs(current.lng - other.lng);

          if (dLat <= clusterThreshold && dLng <= clusterThreshold) {
            group.push(other);
            visited.add(other.id);
          }
        }

        if (group.length === 1) {
          clusters.push({
            type: 'single',
            id: current.id,
            pins: group,
            lat: current.lat,
            lng: current.lng,
            count: 1,
          });
        } else {
          const avgLat = group.reduce((sum, p) => sum + p.lat, 0) / group.length;
          const avgLng = group.reduce((sum, p) => sum + p.lng, 0) / group.length;
          clusters.push({
            type: 'cluster',
            id: `cluster-${current.id}`,
            pins: group,
            lat: avgLat,
            lng: avgLng,
            count: group.length,
          });
        }
      }

      return clusters;
    }, [normalizedPins, zoomLevel]);

    // 3. Responsive Barangay Micro-Labels: displayed ONLY when zoomed in (>= 11.5)
    const showBarangayLabels = zoomLevel >= 11.5 || Boolean(selectedMunicipality);

    const relevantBarangays = useMemo(() => {
      if (!showBarangayLabels) return [];
      if (selectedMunicipality) {
        const norm = normalizeLguName(selectedMunicipality).toLowerCase();
        return ALL_BARANGAY_FEATURES.filter(
          (b: any) => normalizeLguName(b.lgu).toLowerCase() === norm,
        );
      }
      return ALL_BARANGAY_FEATURES.slice(0, 150);
    }, [showBarangayLabels, selectedMunicipality]);

    // 4. Municipal Polygons for Boundary Selection
    const municipalityPolygons = useMemo(() => {
      return (cebuDataRaw?.features || []).map((feat: any) => {
        const rawName = feat.properties?.name || '';
        const coords = extractPolygonCoordinates(feat.geometry);
        const norm = normalizeLguName(rawName);
        const isSelected =
          Boolean(selectedMunicipality) &&
          normalizeLguName(selectedMunicipality || '').toLowerCase() === norm.toLowerCase();

        return {
          rawName,
          normName: norm,
          coords,
          isSelected,
        };
      });
    }, [selectedMunicipality]);

    return (
      <View
        style={[styles.container, { width: mapWidth, height: mapHeight }]}
        testID="cebu-native-map"
      >
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={INITIAL_REGION}
          onRegionChangeComplete={handleRegionChangeComplete}
          customMapStyle={CIVIC_MAP_STYLE}
          showsCompass={false}
          showsScale={false}
          showsMyLocationButton={false}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          {/* Municipal Boundaries */}
          {municipalityPolygons.map((muni) => {
            if (muni.coords.length < 3) return null;
            return (
              <Polygon
                key={muni.rawName}
                testID={`muni-path-${muni.rawName}`}
                coordinates={muni.coords}
                fillColor={muni.isSelected ? 'rgba(31, 61, 60, 0.35)' : 'rgba(31, 61, 60, 0.05)'}
                strokeColor={muni.isSelected ? '#0f2423' : '#3d6e6a'}
                strokeWidth={muni.isSelected ? 2.5 : 1}
                tappable={true}
                onPress={() => {
                  haptics.triggerSelection();
                  onSelectMunicipality?.(muni.normName);
                }}
              />
            );
          })}

          {/* Barangay Micro-Labels (rendered ONLY when zoomed in, compact and readable) */}
          {showBarangayLabels &&
            relevantBarangays.map((b: any, idx: number) => (
              <Marker
                key={`bgy-${b.lgu}-${b.name}-${idx}`}
                coordinate={{ latitude: b.lat, longitude: b.lng }}
                tracksViewChanges={false}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={styles.barangayLabelBadge}>
                  <Text style={styles.barangayLabelText} numberOfLines={1}>
                    {b.name}
                  </Text>
                </View>
              </Marker>
            ))}

          {/* Project Pins & Cluster Badges */}
          {clusteredPins.map((item) => {
            if (item.type === 'cluster') {
              return (
                <Marker
                  key={item.id}
                  coordinate={{ latitude: item.lat, longitude: item.lng }}
                  tracksViewChanges={false}
                  anchor={{ x: 0.5, y: 0.5 }}
                  onPress={() => {
                    haptics.triggerSelection();
                    mapRef.current?.animateToRegion?.(
                      {
                        latitude: item.lat,
                        longitude: item.lng,
                        latitudeDelta: Math.max(0.04, currentRegion.latitudeDelta * 0.4),
                        longitudeDelta: Math.max(0.04, currentRegion.longitudeDelta * 0.4),
                      },
                      400,
                    );
                  }}
                >
                  <View style={styles.clusterBadge}>
                    <Text style={styles.clusterText}>{item.count}</Text>
                  </View>
                </Marker>
              );
            }

            const pin = (item as any).pin || (item as any).pins?.[0];
            if (!pin) return null;

            const isSelected = selectedPinId === pin.id;
            const isDelayed = pin.tone === 'warning' || pin.status === 'Delayed';
            const isCompleted = pin.status === 'Completed';

            return (
              <Marker
                key={pin.id}
                testID={`native-pin-${pin.id}`}
                coordinate={{ latitude: item.lat, longitude: item.lng }}
                tracksViewChanges={false}
                anchor={{ x: 0.5, y: 1.0 }} // Pin tip anchored to exact land coordinates
                onPress={() => {
                  haptics.triggerSelection();
                  onSelectPin?.(pin);
                }}
              >
                {/* Website-Style Diamond Pin */}
                <View
                  style={[
                    styles.diamondPinContainer,
                    isSelected && styles.diamondPinSelected,
                  ]}
                >
                  <View
                    style={[
                      styles.diamondPin,
                      isDelayed
                        ? styles.diamondDelayed
                        : isCompleted
                        ? styles.diamondCompleted
                        : styles.diamondOngoing,
                      isSelected && styles.diamondPinActiveInner,
                    ]}
                  />
                </View>
              </Marker>
            );
          })}
        </MapView>

        {/* Center-Right Floating Map Controls (+ / − / 🎯) */}
        <View style={styles.centerRightControls} testID="center-right-controls">
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={handleZoomIn}
            activeOpacity={0.8}
            testID="zoom-in-btn"
            accessibilityLabel="Zoom In"
          >
            <Text style={styles.controlText}>+</Text>
          </TouchableOpacity>

          <View style={styles.controlDivider} />

          <TouchableOpacity
            style={styles.controlBtn}
            onPress={handleZoomOut}
            activeOpacity={0.8}
            testID="zoom-out-btn"
            accessibilityLabel="Zoom Out"
          >
            <Text style={styles.controlText}>−</Text>
          </TouchableOpacity>

          <View style={styles.controlDivider} />

          <TouchableOpacity
            style={styles.controlBtn}
            onPress={handleRecenter}
            activeOpacity={0.8}
            testID="recenter-btn"
            accessibilityLabel="Recenter Map"
          >
            <Text style={styles.recenterIcon}>🎯</Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic Zoom Level Badge */}
        <View style={styles.zoomBadge}>
          <Text style={styles.zoomBadgeText} testID="zoom-level-badge">
            {zoomLevel}x
          </Text>
        </View>
      </View>
    );
  },
);

export default CebuNativeMapView;

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#cbe3df',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  // Website-style diamond pins
  diamondPinContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diamondPinSelected: {
    transform: [{ scale: 1.3 }],
  },
  diamondPin: {
    width: 14,
    height: 14,
    transform: [{ rotate: '45deg' }],
    borderWidth: 1.5,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 4,
  },
  diamondOngoing: {
    backgroundColor: '#0d9488', // Teal diamond (Ongoing)
  },
  diamondCompleted: {
    backgroundColor: '#0284c7', // Blue diamond (Completed)
  },
  diamondDelayed: {
    backgroundColor: '#f59e0b', // Amber diamond (Delayed/Flagged)
  },
  diamondPinActiveInner: {
    borderColor: '#ffffff',
    borderWidth: 2,
    backgroundColor: '#10b981',
  },
  // Proximity cluster bubble
  clusterBadge: {
    backgroundColor: '#1f3d3c',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 2,
    borderColor: '#34d399',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  clusterText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  // Responsive micro-label for barangays (compact, clean, no giant text)
  barangayLabelBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#94a3b8',
  },
  barangayLabelText: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#133632',
  },
  // Center-Right Floating Map Controls
  centerRightControls: {
    position: 'absolute',
    right: 14,
    top: '35%',
    backgroundColor: 'rgba(22, 46, 45, 0.92)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 90,
  },
  controlBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    lineHeight: 22,
  },
  recenterIcon: {
    fontSize: 14,
  },
  controlDivider: {
    height: 1,
    backgroundColor: 'rgba(52, 211, 153, 0.2)',
  },
  zoomBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: 'rgba(22, 46, 45, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
    zIndex: 80,
  },
  zoomBadgeText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '800',
  },
});
