import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HomeScreen from './src/ui/screens/HomeScreen';
import MapScreen from './src/ui/screens/MapScreen';
import ContractorRankingScreen from './src/ui/screens/ContractorRankingScreen';
import SignInScreen from './src/ui/screens/SignInScreen';
import SignUpScreen from './src/ui/screens/SignUpScreen';
import BottomTabBar, { TabName } from './src/ui/components/BottomTabBar';

type AuthScreenName = 'signin' | 'signup' | null;

const isWeb = Platform.OS === 'web';

// Inject full-height reset on Web to prevent 0px height collapse
if (isWeb && typeof document !== 'undefined') {
  const styleId = 'projecttrack-web-reset';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
      html, body, #root {
        height: 100%;
        min-height: 100%;
        width: 100%;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        background-color: #0f2423;
        overflow: hidden;
      }
    `;
    document.head.appendChild(style);
  }
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ProjectTRACK ErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.icon}>⚠️</Text>
          <Text style={errorStyles.title}>Something went wrong</Text>
          <Text style={errorStyles.message}>
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </Text>
          <TouchableOpacity
            style={errorStyles.button}
            onPress={() => this.setState({ hasError: false, error: null })}
            activeOpacity={0.8}
          >
            <Text style={errorStyles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabName>('home');
  const [authScreen, setAuthScreen] = useState<AuthScreenName>(null);
  const [focusedLgu, setFocusedLgu] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    email: string;
  } | null>(null);

  const handleSignInSuccess = (user: { email: string }) => {
    setCurrentUser(user);
    setAuthScreen(null);
  };

  const handleSignOut = () => {
    setCurrentUser(null);
  };

  const initialMetrics = isWeb
    ? {
        frame: { x: 0, y: 0, width: 0, height: 0 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }
    : undefined;

  return (
    <ErrorBoundary>
      <SafeAreaProvider initialMetrics={initialMetrics} style={styles.safeArea}>
        <View style={styles.container}>
          <StatusBar barStyle="light-content" backgroundColor="#162e2d" />

          {/* If user is in an authentication flow */}
          {authScreen === 'signin' && (
            <SignInScreen
              onSuccess={handleSignInSuccess}
              onNavigateToSignUp={() => setAuthScreen('signup')}
              onBack={() => setAuthScreen(null)}
            />
          )}

          {authScreen === 'signup' && (
            <SignUpScreen
              onSuccess={handleSignInSuccess}
              onNavigateToSignIn={() => setAuthScreen('signin')}
              onBackToMap={() => setAuthScreen(null)}
            />
          )}

          {/* Main Tab Views with Persistent Bottom Navigation */}
          {authScreen === null && (
            <>
              <View style={styles.screenContent}>
                {activeTab === 'home' && (
                  <HomeScreen
                    currentUser={currentUser}
                    onNavigateToSignIn={() => setAuthScreen('signin')}
                    onNavigateToContractors={() => setActiveTab('contractors')}
                    onNavigateToMap={(lgu) => {
                      setFocusedLgu(lgu || null);
                      setActiveTab('map');
                    }}
                    onSignOut={handleSignOut}
                  />
                )}

                {activeTab === 'map' && (
                  <MapScreen
                    currentUser={currentUser}
                    initialLgu={focusedLgu}
                    onNavigateToSignIn={() => setAuthScreen('signin')}
                    onNavigateToContractors={() => setActiveTab('contractors')}
                    onSignOut={handleSignOut}
                  />
                )}

                {activeTab === 'contractors' && (
                  <ContractorRankingScreen
                    onBackToMap={() => setActiveTab('map')}
                  />
                )}
              </View>

              {/* Persistent Bottom Tab Bar with Center Elevated Map Button */}
              <BottomTabBar
                activeTab={activeTab}
                onSelectTab={(tab) => {
                  setActiveTab(tab);
                }}
              />
            </>
          )}
        </View>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f2423',
    height: '100%',
    width: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: '#0f2423',
    height: '100%',
    width: '100%',
  },
  screenContent: {
    flex: 1,
    height: '100%',
    width: '100%',
  },
});

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f2423',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    height: '100%',
    width: '100%',
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#dceae8',
    textAlign: 'center',
    marginBottom: 20,
    maxWidth: 420,
  },
  button: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
});
