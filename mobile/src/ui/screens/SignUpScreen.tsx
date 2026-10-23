import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { api, resolveOAuthRedirect, NATIVE_OAUTH_REDIRECT } from '../../services/api';
import Logo from '../components/Logo';

// Safely import expo-web-browser for in-app pop-up auth session
let WebBrowser: any = null;
try {
  WebBrowser = require('expo-web-browser');
  WebBrowser?.maybeCompleteAuthSession?.();
} catch {
  // Gracefully fallback to Linking if not installed
}

interface SignUpScreenProps {
  onSuccess: (user: { email: string }) => void;
  onNavigateToSignIn: () => void;
  onBackToMap: () => void;
}

export default function SignUpScreen({
  onSuccess,
  onNavigateToSignIn,
  onBackToMap,
}: SignUpScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Helper to process OAuth callback tokens from URL
  const processOAuthUrl = async (url: string) => {
    if (!url || !url.includes('auth/callback')) return;

    setStatusMessage('Verifying authentication…');
    setErrorMessage(null);

    try {
      const fragment = url.includes('#') ? url.split('#')[1] : '';
      const query = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
      const params = new URLSearchParams(fragment || query);

      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token') || undefined;

      if (!accessToken) {
        const errorDesc =
          params.get('error_description') ||
          params.get('error') ||
          'Google sign-up was canceled or failed.';
        setErrorMessage(decodeURIComponent(errorDesc.replace(/\+/g, ' ')));
        setStatusMessage(null);
        setIsGoogleLoading(false);
        return;
      }

      const { user, error } = await api.exchangeOAuthCallback(accessToken, refreshToken);
      if (error || !user) {
        setErrorMessage(error || 'Failed to complete Google sign-up.');
        setStatusMessage(null);
        setIsGoogleLoading(false);
        return;
      }

      setStatusMessage('Success! Account verified…');
      onSuccess(user);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error processing authentication callback.');
      setStatusMessage(null);
      setIsGoogleLoading(false);
    }
  };

  // Deep-link listener safety net
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      processOAuthUrl(event.url);
    };

    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl) {
        processOAuthUrl(initialUrl);
      }
    });

    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => {
      subscription.remove();
    };
  }, [onSuccess]);

  // In-app Google pop-up sign-up
  const handleGoogleSignUp = async () => {
    setIsGoogleLoading(true);
    setErrorMessage(null);
    setStatusMessage('Opening Google Sign-Up…');

    try {
      // Keep Google OAuth isolated to THIS app: redirect back to the mobile
      // app's own callback, never the deployed website.
      const redirectUri = resolveOAuthRedirect();
      const { url, error } = await api.getOAuthUrl('google', redirectUri);

      if (error || !url) {
        setErrorMessage(error || 'Could not initiate Google sign-up.');
        setStatusMessage(null);
        setIsGoogleLoading(false);
        return;
      }

      const callbackScheme = redirectUri || NATIVE_OAUTH_REDIRECT;
      if (WebBrowser && typeof WebBrowser.openAuthSessionAsync === 'function') {
        const result = await WebBrowser.openAuthSessionAsync(url, callbackScheme);
        if (result.type === 'success' && result.url) {
          await processOAuthUrl(result.url);
        } else if (result.type === 'cancel' || result.type === 'dismiss') {
          setIsGoogleLoading(false);
          setStatusMessage(null);
        }
      } else {
        await Linking.openURL(url);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to open Google sign-up.');
      setStatusMessage(null);
      setIsGoogleLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter email and password.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const { user, message, error } = await api.signUp(email.trim(), password);
      setIsSubmitting(false);

      if (error) {
        setErrorMessage(error);
        return;
      }

      if (user?.email || user?.id) {
        setStatusMessage('Account created! Logging you in…');
        setTimeout(() => {
          onSuccess(user);
        }, 500);
      } else {
        setStatusMessage(
          message || 'Account created! Please check your email to confirm before signing in.',
        );
      }
    } catch {
      setIsSubmitting(false);
      setErrorMessage('Network error: Unable to connect to server.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} testID="signup-screen">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back Action */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBackToMap}
            activeOpacity={0.7}
            testID="back-to-map-btn"
          >
            <Text style={styles.backButtonText}>← Back to Map</Text>
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.brandHeader}>
            <View style={styles.logoBadge}>
              <Logo size={40} variant="light" testID="signup-logo" />
            </View>
            <Text style={styles.brandTitle}>Create account</Text>
            <Text style={styles.brandSubtitle}>
              Join ProjectTRACK to track Cebu public works, file anomaly reports,
              and ask the GraphRAG assistant.
            </Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            {/* Google Social Sign Up */}
            <TouchableOpacity
              style={styles.socialBtn}
              onPress={handleGoogleSignUp}
              activeOpacity={0.8}
              disabled={isGoogleLoading || isSubmitting}
              testID="google-signup-btn"
            >
              {isGoogleLoading ? (
                <ActivityIndicator size="small" color="#1f3d3c" />
              ) : (
                <>
                  <Text style={styles.socialIcon}>G</Text>
                  <Text style={styles.socialBtnText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or with email</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Email Field */}
            <Text style={styles.inputLabel}>EMAIL</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="#94a3b8"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errorMessage) setErrorMessage(null);
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!isSubmitting}
              testID="signup-email-input"
            />

            {/* Password Field */}
            <Text style={styles.inputLabel}>PASSWORD</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#94a3b8"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errorMessage) setErrorMessage(null);
              }}
              secureTextEntry={true}
              editable={!isSubmitting}
              testID="signup-password-input"
            />

            {/* Confirm Password Field */}
            <Text style={styles.inputLabel}>CONFIRM PASSWORD</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#94a3b8"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (errorMessage) setErrorMessage(null);
              }}
              secureTextEntry={true}
              editable={!isSubmitting}
              testID="signup-confirm-password-input"
            />

            {/* Error & Status Messages */}
            {errorMessage && (
              <View style={styles.errorBox} testID="signup-error-box">
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {statusMessage && (
              <View style={styles.statusBox} testID="signup-status-box">
                <Text style={styles.statusText}>{statusMessage}</Text>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSignUp}
              activeOpacity={0.8}
              disabled={isSubmitting || isGoogleLoading}
              testID="submit-signup-btn"
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.submitButtonText}>Create account</Text>
              )}
            </TouchableOpacity>

            {/* Toggle to Sign In */}
            <TouchableOpacity
              style={styles.switchRow}
              onPress={onNavigateToSignIn}
              testID="navigate-to-signin-btn"
            >
              <Text style={styles.switchText}>
                Already have an account?{' '}
                <Text style={styles.switchTextHighlight}>Sign in</Text>
              </Text>
            </TouchableOpacity>

            <Text style={styles.termsText}>
              By continuing you agree to ProjectTRACK&apos;s terms and privacy policy.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
    height: '100%',
    width: '100%',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  backButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1f3d3c',
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#1f3d3c',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  logoBadgeText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
  },
  brandSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 10,
    gap: 8,
    minHeight: 46,
  },
  socialIcon: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1f3d3c',
  },
  socialBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  dividerText: {
    paddingHorizontal: 10,
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#1e293b',
    marginBottom: 6,
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    padding: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#b91c1c',
  },
  statusBox: {
    backgroundColor: '#e6fffa',
    padding: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0d9488',
  },
  submitButton: {
    backgroundColor: '#1f3d3c',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 16,
    minHeight: 46,
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  switchRow: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 4,
  },
  switchText: {
    fontSize: 12,
    color: '#64748b',
  },
  switchTextHighlight: {
    color: '#1f3d3c',
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  termsText: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 15,
  },
});
