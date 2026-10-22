import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { HierarchyFilterTier } from '../../core/types';
import { getLguClassification } from '../../core/geoUtils';
import { haptics } from '../../services/haptics';

export interface CebuMapHierarchyBarProps {
  selectedTier: HierarchyFilterTier;
  onSelectTier: (tier: HierarchyFilterTier) => void;
  selectedLgu?: string | null;
  onResetLgu?: () => void;
  testID?: string;
}

interface TierItem {
  id: HierarchyFilterTier;
  label: string;
  countBadge: string;
  icon: string;
}

const HIERARCHY_TIERS: TierItem[] = [
  { id: 'ALL', label: 'All Cebu', countBadge: '53', icon: '🏝️' },
  { id: 'CITIES', label: 'Cities', countBadge: '9', icon: '🏙️' },
  { id: 'MUNICIPALITIES', label: 'Municipalities', countBadge: '44', icon: '🌾' },
  { id: 'METRO_CEBU', label: 'Metro Cebu', countBadge: '13', icon: '🏢' },
];

export default function CebuMapHierarchyBar({
  selectedTier,
  onSelectTier,
  selectedLgu,
  onResetLgu,
  testID = 'cebu-map-hierarchy-bar',
}: CebuMapHierarchyBarProps) {
  const handleSelectTier = (tier: HierarchyFilterTier) => {
    haptics.triggerLightImpact();
    onSelectTier(tier);
  };

  const selectedLguMeta = selectedLgu ? getLguClassification(selectedLgu) : null;

  return (
    <View style={styles.container} testID={testID}>
      {/* 1. Administrative Breadcrumb Row */}
      <View style={styles.breadcrumbRow}>
        <View style={styles.breadcrumbLeft}>
          <Text style={styles.provinceLabel}>📍 Cebu Province</Text>
          {selectedLguMeta && (
            <>
              <Text style={styles.breadcrumbSeparator}>›</Text>
              <View
                style={[
                  styles.lguBadge,
                  selectedLguMeta.type === 'HUC'
                    ? styles.badgeHuc
                    : selectedLguMeta.type === 'COMPONENT_CITY'
                    ? styles.badgeCity
                    : styles.badgeMuni,
                ]}
                testID="active-lgu-classification-badge"
              >
                <Text style={styles.lguBadgeIcon}>
                  {selectedLguMeta.type === 'HUC'
                    ? '👑'
                    : selectedLguMeta.type === 'COMPONENT_CITY'
                    ? '🏢'
                    : '🌾'}
                </Text>
                <Text style={styles.lguBadgeText} numberOfLines={1}>
                  {selectedLguMeta.normalizedName}
                </Text>
                <Text style={styles.lguClassificationLabel}>
                  (
                  {selectedLguMeta.type === 'HUC'
                    ? 'HUC'
                    : selectedLguMeta.type === 'COMPONENT_CITY'
                    ? 'City'
                    : 'Municipality'}
                  )
                </Text>
              </View>
            </>
          )}
        </View>

        {selectedLgu && (
          <TouchableOpacity
            style={styles.clearLguBtn}
            onPress={() => {
              haptics.triggerLightImpact();
              onResetLgu?.();
            }}
            activeOpacity={0.8}
            testID="clear-lgu-selection-btn"
            accessibilityLabel="Clear LGU selection"
          >
            <Text style={styles.clearLguText}>✕ View Province</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 2. Horizontal Tier Filter Selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tiersScroll}
      >
        {HIERARCHY_TIERS.map((tier) => {
          const isActive = selectedTier === tier.id;
          return (
            <TouchableOpacity
              key={tier.id}
              style={[styles.tierPill, isActive && styles.tierPillActive]}
              onPress={() => handleSelectTier(tier.id)}
              activeOpacity={0.7}
              testID={`hierarchy-tier-${tier.id.toLowerCase()}`}
            >
              <Text style={styles.tierIcon}>{tier.icon}</Text>
              <Text
                style={[styles.tierLabel, isActive && styles.tierLabelActive]}
              >
                {tier.label}
              </Text>
              <View
                style={[
                  styles.countBadge,
                  isActive && styles.countBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.countBadgeText,
                    isActive && styles.countBadgeTextActive,
                  ]}
                >
                  {tier.countBadge}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#162e2d',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(52, 211, 153, 0.2)',
    paddingVertical: 8,
    zIndex: 20,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
      },
    }),
  },
  breadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  breadcrumbLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  provinceLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#34d399',
    letterSpacing: 0.3,
  },
  breadcrumbSeparator: {
    fontSize: 14,
    color: '#869e9a',
    marginHorizontal: 6,
  },
  lguBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    maxWidth: '65%',
  },
  badgeHuc: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  badgeCity: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  badgeMuni: {
    backgroundColor: 'rgba(52, 211, 153, 0.2)',
    borderWidth: 1,
    borderColor: '#34d399',
  },
  lguBadgeIcon: {
    fontSize: 11,
  },
  lguBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  lguClassificationLabel: {
    fontSize: 10,
    color: '#a7f3d0',
    fontWeight: '600',
  },
  clearLguBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  clearLguText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  tiersScroll: {
    paddingHorizontal: 12,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1f3d3c',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  tierPillActive: {
    backgroundColor: '#0f766e',
    borderColor: '#34d399',
  },
  tierIcon: {
    fontSize: 12,
  },
  tierLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  tierLabelActive: {
    color: '#ffffff',
  },
  countBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  countBadgeActive: {
    backgroundColor: '#10b981',
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
  },
  countBadgeTextActive: {
    color: '#ffffff',
  },
});
