import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const insets = useSafeAreaInsets();
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
    <View
      style={[
        styles.container,
        {
          paddingTop: Platform.select({
            ios: Math.max(insets.top, 24),
            android: Math.max(insets.top, 10),
            default: 10,
          }),
        },
      ]}
      testID="map-header"
    >
      {/* 1. App Name on Top */}
      <View style={styles.brandRow}>
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
      </View>

      {/* 2. Search Bar - Sign In Button Below */}
      <View style={styles.actionRow}>
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
    paddingBottom: 10,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    zIndex: 10,
    gap: 6,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badgeIndicator: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#34d399',
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 40,
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
    fontSize: 13,
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
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
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
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 18,
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
