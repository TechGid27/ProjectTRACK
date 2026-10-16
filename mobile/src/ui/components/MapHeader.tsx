import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';

interface MapHeaderProps {
  totalLgus: number;
  totalPins: number;
  onSearch: (query: string) => void;
  onSignInPress: () => void;
  onResetSelection?: () => void;
}

export default function MapHeader({
  totalLgus,
  totalPins,
  onSearch,
  onSignInPress,
  onResetSelection,
}: MapHeaderProps) {
  const [query, setQuery] = useState('');

  const handleChangeText = (text: string) => {
    setQuery(text);
    onSearch(text);
  };

  const handleClear = () => {
    setQuery('');
    onSearch('');
    onResetSelection?.();
  };

  return (
    <View style={styles.container} testID="map-header">
      {/* Top Bar with Brand & Actions */}
      <View style={styles.topRow}>
        <TouchableOpacity
          onPress={onResetSelection}
          activeOpacity={0.8}
          style={styles.brandContainer}
        >
          <View style={styles.badgeIndicator} />
          <Text style={styles.brandTitle}>Reyal Or Pake</Text>
        </TouchableOpacity>

        <View style={styles.actionRow}>
          <View style={styles.statsBadge}>
            <Text style={styles.statsBadgeText}>
              {totalLgus} LGUs · {totalPins} Sites
            </Text>
          </View>

          <TouchableOpacity
            style={styles.signInButton}
            onPress={onSignInPress}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Sign In"
          >
            <Text style={styles.signInText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Input Row */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search municipality or project..."
            placeholderTextColor="#869e9a"
            value={query}
            onChangeText={handleChangeText}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={handleClear}
              style={styles.clearButton}
              accessibilityLabel="Clear search"
            >
              <Text style={styles.clearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1f3d3c', // Deep teal matching ProjectTRACK web theme
    paddingTop: Platform.OS === 'ios' ? 48 : 36,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    zIndex: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badgeIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10b981', // Emerald active dot
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statsBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  statsBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#dceae8',
  },
  signInButton: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  signInText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1f3d3c',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937',
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
  },
  clearText: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '700',
  },
});
