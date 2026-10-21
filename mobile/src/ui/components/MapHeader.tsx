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
  totalLgus?: number;
  totalPins?: number;
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
  currentUser,
  onSearch,
  onSignInPress,
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
      <View style={styles.headerRow}>
        {/* 1. App Name */}
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
          <Text style={styles.brandTitle}>ProjectTRACK</Text>
        </TouchableOpacity>

        {/* 2. Compact Centered Search Bar */}
        <View style={styles.searchContainer}>
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

        {/* 3. Sign In / Profile Button */}
        <View style={styles.authContainer}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1f3d3c',
    paddingTop: Platform.OS === 'ios' ? 50 : 38,
    paddingBottom: 10,
    paddingHorizontal: 14,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34d399',
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 10,
    height: 38,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  searchIcon: {
    fontSize: 13,
    marginRight: 6,
    color: '#869e9a',
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
    paddingVertical: 0,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
  clearButton: {
    padding: 4,
  },
  clearText: {
    color: '#a3b8b5',
    fontSize: 12,
    fontWeight: 'bold',
  },
  authContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  signInButton: {
    backgroundColor: '#34d399',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInText: {
    color: '#0f2423',
    fontSize: 12,
    fontWeight: '800',
  },
  userProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 16,
  },
  avatarCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#34d399',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#0f2423',
    fontSize: 11,
    fontWeight: 'bold',
  },
  signOutText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
});
