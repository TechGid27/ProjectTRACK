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
  activeScreen?: 'home' | 'contractors' | 'signin' | 'signup';
  currentUser?: { email: string } | null;
  onSearch: (query: string) => void;
  onSignInPress: () => void;
  onNavigateToContractors?: () => void;
  onNavigateToHome?: () => void;
  onSignOut?: () => void;
  onResetSelection?: () => void;
}

export default function MapHeader({
  totalLgus,
  totalPins,
  activeScreen = 'home',
  currentUser,
  onSearch,
  onSignInPress,
  onNavigateToContractors,
  onNavigateToHome,
  onSignOut,
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

  const userInitial = currentUser?.email
    ? currentUser.email.charAt(0).toUpperCase()
    : 'U';

  return (
    <View style={styles.container} testID="map-header">
      {/* Top Bar with Brand & Actions */}
      <View style={styles.topRow}>
        <TouchableOpacity
          onPress={() => {
            onResetSelection?.();
            onNavigateToHome?.();
          }}
          activeOpacity={0.8}
          style={styles.brandContainer}
          testID="brand-home-btn"
        >
          <View style={styles.badgeIndicator} />
          <Text style={styles.brandTitle}>Reyal Or Pake</Text>
        </TouchableOpacity>

        {/* Navigation Tabs & Auth */}
        <View style={styles.actionRow}>
          {onNavigateToContractors && (
            <TouchableOpacity
              style={[
                styles.navTab,
                activeScreen === 'contractors' && styles.navTabActive,
              ]}
              onPress={onNavigateToContractors}
              activeOpacity={0.7}
              testID="nav-contractors-btn"
            >
              <Text
                style={[
                  styles.navTabText,
                  activeScreen === 'contractors' && styles.navTabTextActive,
                ]}
              >
                Contractors
              </Text>
            </TouchableOpacity>
          )}

          {currentUser ? (
            <TouchableOpacity
              style={styles.userProfileBtn}
              onPress={onSignOut}
              activeOpacity={0.8}
              testID="sign-out-btn"
              accessibilityLabel={`Sign out ${currentUser.email}`}
            >
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{userInitial}</Text>
              </View>
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.signInButton}
              onPress={onSignInPress}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Sign In"
              testID="sign-in-nav-btn"
            >
              <Text style={styles.signInText}>Sign In</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Sub-header with LGU Stats and Search */}
      <View style={styles.subHeaderRow}>
        <View style={styles.statsBadge}>
          <Text style={styles.statsBadgeText}>
            {totalLgus} LGUs · {totalPins} Sites
          </Text>
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
            testID="map-search-input"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={handleClear}
              style={styles.clearButton}
              accessibilityLabel="Clear search"
              testID="clear-search-btn"
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
    marginBottom: 8,
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
  navTab: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  navTabActive: {
    backgroundColor: '#ffffff',
  },
  navTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#dceae8',
  },
  navTabTextActive: {
    color: '#1f3d3c',
  },
  subHeaderRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  statsBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  statsBadgeText: {
    fontSize: 10,
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
  userProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 6,
  },
  avatarCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ffffff',
  },
  signOutText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
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
    height: 38,
  },
  searchIcon: {
    fontSize: 13,
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
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
