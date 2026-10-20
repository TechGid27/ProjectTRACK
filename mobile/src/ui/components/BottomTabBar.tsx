import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptics } from '../../services/haptics';

export type TabName = 'home' | 'map' | 'contractors';

export interface BottomTabBarProps {
  activeTab: TabName;
  onSelectTab: (tab: TabName) => void;
}

export default function BottomTabBar({
  activeTab,
  onSelectTab,
}: BottomTabBarProps) {
  let insets = { bottom: 0 };
  try {
    // Graceful fallback if SafeAreaProvider is not yet mounted in test environments
    insets = useSafeAreaInsets();
  } catch {
    insets = { bottom: 0 };
  }

  const handlePress = (tab: TabName) => {
    haptics.triggerLightImpact();
    onSelectTab(tab);
  };

  const isHomeActive = activeTab === 'home';
  const isMapActive = activeTab === 'map';
  const isContractorsActive = activeTab === 'contractors';

  return (
    <View
      style={[
        styles.barContainer,
        { paddingBottom: Math.max(8, insets.bottom || 8) },
      ]}
      testID="bottom-tab-bar"
    >
      {/* Home Tab (Left) */}
      <TouchableOpacity
        style={styles.sideTab}
        onPress={() => handlePress('home')}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Navigate to Home"
        testID="nav-tab-home"
      >
        <Text style={[styles.tabIcon, isHomeActive && styles.activeTabIcon]}>
          🏠
        </Text>
        <Text style={[styles.tabLabel, isHomeActive && styles.activeTabLabel]}>
          Home
        </Text>
        {isHomeActive && <View style={styles.activeIndicator} />}
      </TouchableOpacity>

      {/* Center Elevated Map Tab */}
      <View style={styles.centerContainer}>
        <TouchableOpacity
          style={[
            styles.centerButton,
            isMapActive && styles.centerButtonActive,
          ]}
          onPress={() => handlePress('map')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Navigate to Interactive Cebu Map"
          testID="nav-tab-map"
        >
          <Text style={styles.centerButtonIcon}>🗺️</Text>
        </TouchableOpacity>
        <Text
          style={[
            styles.centerButtonLabel,
            isMapActive && styles.activeTabLabel,
          ]}
        >
          Map
        </Text>
      </View>

      {/* Contractors Tab (Right) */}
      <TouchableOpacity
        style={styles.sideTab}
        onPress={() => handlePress('contractors')}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Navigate to Contractor Rankings"
        testID="nav-tab-contractors"
      >
        <Text
          style={[
            styles.tabIcon,
            isContractorsActive && styles.activeTabIcon,
          ]}
        >
          🏆
        </Text>
        <Text
          style={[
            styles.tabLabel,
            isContractorsActive && styles.activeTabLabel,
          ]}
        >
          Contractors
        </Text>
        {isContractorsActive && <View style={styles.activeIndicator} />}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  barContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#162e2d',
    borderTopWidth: 1,
    borderTopColor: '#244846',
    paddingTop: 8,
    position: 'relative',
    zIndex: 90,
    ...Platform.select({
      web: {
        boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.25)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 12,
      },
    }),
  },
  sideTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    position: 'relative',
  },
  tabIcon: {
    fontSize: 22,
    marginBottom: 2,
    opacity: 0.7,
  },
  activeTabIcon: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
  },
  activeTabLabel: {
    color: '#10b981',
    fontWeight: '800',
  },
  activeIndicator: {
    width: 18,
    height: 3,
    backgroundColor: '#10b981',
    borderRadius: 2,
    marginTop: 3,
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
    width: 76,
  },
  centerButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#1f3d3c',
    borderWidth: 3,
    borderColor: '#34d399',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 6px 14px rgba(16, 185, 129, 0.35)',
      },
      default: {
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 14,
      },
    }),
  },
  centerButtonActive: {
    backgroundColor: '#10b981',
    borderColor: '#6ee7b7',
  },
  centerButtonIcon: {
    fontSize: 26,
  },
  centerButtonLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#dceae8',
    marginTop: 4,
  },
});
