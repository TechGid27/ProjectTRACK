import React, { useState } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HomeScreen from './src/ui/screens/HomeScreen';
import SignInScreen from './src/ui/screens/SignInScreen';

type ScreenName = 'home' | 'signin';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('home');
  const [currentUser, setCurrentUser] = useState<{
    email: string;
    role: string;
  } | null>(null);

  const handleSignInSuccess = (user: { email: string; role: string }) => {
    setCurrentUser(user);
    setCurrentScreen('home');
  };

  return (
    <SafeAreaProvider>
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1f3d3c',
  },
});
