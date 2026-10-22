import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { CEBU_REGION_PRESETS, RegionPreset } from '../../core/geoUtils';
import { haptics } from '../../services/haptics';

export interface CebuRegionQuickJumpProps {
  onSelectPreset: (preset: RegionPreset) => void;
  activePresetId?: string | null;
  testID?: string;
}

export default function CebuRegionQuickJump({
  onSelectPreset,
  activePresetId = 'ALL_CEBU',
  testID = 'cebu-region-quick-jump',
}: CebuRegionQuickJumpProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSelect = (preset: RegionPreset) => {
    haptics.triggerLightImpact();
    onSelectPreset(preset);
  };

  return (
    <View style={styles.floatingContainer} testID={testID}>
      {/* Quick Jump Bar Toggle Button */}
      <TouchableOpacity
        style={styles.toggleBtn}
        onPress={() => {
          haptics.triggerSelection();
          setIsExpanded((prev) => !prev);
        }}
        activeOpacity={0.8}
        testID="region-quick-jump-toggle-btn"
        accessibilityLabel="Toggle Region Focus Presets"
      >
        <Text style={styles.toggleIcon}>🧭</Text>
        <Text style={styles.toggleText}>
          {isExpanded ? 'Hide Regions' : 'Focus Region'}
        </Text>
        <Text style={styles.toggleChevron}>{isExpanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {/* Expanded Horizontal Presets Carousel */}
      {isExpanded && (
        <View style={styles.carouselWrapper} testID="region-presets-carousel">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {CEBU_REGION_PRESETS.map((preset) => {
              const isActive = activePresetId === preset.id;
              return (
                <TouchableOpacity
                  key={preset.id}
                  style={[
                    styles.presetCard,
                    isActive && styles.presetCardActive,
                  ]}
                  onPress={() => handleSelect(preset)}
                  activeOpacity={0.7}
                  testID={`region-preset-${preset.id.toLowerCase()}`}
                >
                  <Text style={styles.presetIcon}>{preset.icon}</Text>
                  <View style={styles.presetTextCol}>
                    <Text
                      style={[
                        styles.presetLabel,
                        isActive && styles.presetLabelActive,
                      ]}
                      numberOfLines={1}
                    >
                      {preset.label}
                    </Text>
                    <Text style={styles.presetSubtitle} numberOfLines={1}>
                      {preset.subtitle}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    top: 10,
    left: 14,
    zIndex: 85,
    maxWidth: '92%',
  },
  toggleBtn: {
    backgroundColor: 'rgba(22, 46, 45, 0.94)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.4)',
    ...Platform.select({
      web: {
        boxShadow: '0 3px 10px rgba(0, 0, 0, 0.3)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 6,
      },
    }),
  },
  toggleIcon: {
    fontSize: 13,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#34d399',
  },
  toggleChevron: {
    fontSize: 10,
    color: '#869e9a',
  },
  carouselWrapper: {
    marginTop: 6,
    backgroundColor: 'rgba(15, 36, 35, 0.96)',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
    ...Platform.select({
      web: {
        boxShadow: '0 6px 16px rgba(0, 0, 0, 0.4)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
        elevation: 8,
      },
    }),
  },
  scrollContent: {
    paddingHorizontal: 8,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  presetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1f3d3c',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  presetCardActive: {
    backgroundColor: '#0f766e',
    borderColor: '#34d399',
  },
  presetIcon: {
    fontSize: 16,
  },
  presetTextCol: {
    flexDirection: 'column',
  },
  presetLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  presetLabelActive: {
    color: '#a7f3d0',
  },
  presetSubtitle: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '500',
  },
});
