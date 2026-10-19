import React, { useState } from 'react';
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
} from 'react-native';

interface SignInScreenProps {
  onSuccess: (user: { email: string; role?: string }) => void;
  onNavigateToSignUp?: () => void;
  onBack: () => void;
}

export default function SignInScreen({
  onSuccess,
  onNavigateToSignUp,
  onBack,
}: SignInScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleSocialSignIn = (provider: string) => {
    setStatusMessage(`Redirecting to ${provider}…`);
  };

  const handleSignIn = () => {
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter your email and password.');
      return;
    }

    setErrorMessage(null);
    onSuccess({
      email: email.trim(),
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} testID="signin-screen">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Back Action */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
            testID="back-to-map-btn"
          >
            <Text style={styles.backButtonText}>← Back to Map</Text>
          </TouchableOpacity>

          {/* Branding Header */}
          <View style={styles.brandHeader}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoBadgeText}>PT</Text>
            </View>
            <Text style={styles.brandTitle}>Sign in</Text>
            <Text style={styles.brandSubtitle}>
              Access ProjectTRACK with your Facebook or Google account, or with
              your email and password.
            </Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            {/* Social Logins */}
            <TouchableOpacity
              style={styles.socialBtn}
              onPress={() => handleSocialSignIn('Google')}
              activeOpacity={0.8}
              testID="google-signin-btn"
            >
              <Text style={styles.socialIcon}>G</Text>
              <Text style={styles.socialBtnText}>Continue with Google</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.socialBtn}
              onPress={() => handleSocialSignIn('Facebook')}
              activeOpacity={0.8}
              testID="facebook-signin-btn"
            >
              <Text style={styles.socialIcon}>f</Text>
              <Text style={styles.socialBtnText}>Continue with Facebook</Text>
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
              testID="signin-email-input"
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
              testID="signin-password-input"
            />

            {/* Error Message */}
            {errorMessage && (
              <View style={styles.errorBox} testID="signin-error-box">
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Status Message */}
            {statusMessage && (
              <View style={styles.statusBox} testID="signin-status-box">
                <Text style={styles.statusText}>{statusMessage}</Text>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSignIn}
              activeOpacity={0.8}
              testID="submit-signin-btn"
            >
              <Text style={styles.submitButtonText}>Sign in with email</Text>
            </TouchableOpacity>

            {/* Switch to Sign Up */}
            {onNavigateToSignUp && (
              <TouchableOpacity
                style={styles.switchRow}
                onPress={onNavigateToSignUp}
                testID="navigate-to-signup-btn"
              >
                <Text style={styles.switchText}>
                  New here?{' '}
                  <Text style={styles.switchTextHighlight}>Create an account</Text>
                </Text>
              </TouchableOpacity>
            )}

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
