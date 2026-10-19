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

  const handleSocialSignUp = (provider: string) => {
    setStatusMessage(`Redirecting to ${provider} sign-up…`);
  };

  const handleSignUp = () => {
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

    setErrorMessage(null);
    setStatusMessage('Account created! Logging you in…');
    setTimeout(() => {
      onSuccess({ email: email.trim() });
    }, 500);
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
              <Text style={styles.logoBadgeText}>PT</Text>
            </View>
            <Text style={styles.brandTitle}>Create account</Text>
            <Text style={styles.brandSubtitle}>
              Join ProjectTRACK to track Cebu public works, file anomaly reports,
              and ask the GraphRAG assistant.
            </Text>
          </View>

          {/* Social Sign Up */}
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.socialBtn}
              onPress={() => handleSocialSignUp('Google')}
              activeOpacity={0.8}
              testID="google-signup-btn"
            >
              <Text style={styles.socialIcon}>G</Text>
              <Text style={styles.socialBtnText}>Continue with Google</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.socialBtn}
              onPress={() => handleSocialSignUp('Facebook')}
              activeOpacity={0.8}
              testID="facebook-signup-btn"
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
              style={styles.submitButton}
              onPress={handleSignUp}
              activeOpacity={0.8}
              testID="submit-signup-btn"
            >
              <Text style={styles.submitButtonText}>Create account</Text>
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
