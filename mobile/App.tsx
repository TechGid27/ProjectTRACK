import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HomeScreen from './src/ui/screens/HomeScreen';
import SignInScreen from './src/ui/screens/SignInScreen';

type ScreenName = 'home' | 'signin';

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
        background-color: #1f3d3c;
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
          <Pressable
            style={({ pressed }) => [errorStyles.button, pressed && { opacity: 0.8 }]}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={errorStyles.buttonText}>Try Again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('home');
  const [, setCurrentUser] = useState<{
    email: string;
    role: string;
  } | null>(null);

  const handleSignInSuccess = (user: { email: string; role: string }) => {
    setCurrentUser(user);
    setCurrentScreen('home');
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
          <StatusBar barStyle="light-content" backgroundColor="#1f3d3c" />
          {currentScreen === 'home' ? (
            <HomeScreen
              onNavigateToSignIn={() => setCurrentScreen('signin')}
            />
          ) : (
            <SignInScreen
              onSuccess={handleSignInSuccess}
              onBack={() => setCurrentScreen('home')}
            />
          )}
        </View>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1f3d3c',
    height: '100%',
    width: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: '#1f3d3c',
    height: '100%',
    width: '100%',
  },
});

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1f3d3c',
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
