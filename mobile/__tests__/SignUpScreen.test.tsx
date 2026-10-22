import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import SignUpScreen from '../src/ui/screens/SignUpScreen';
import { api } from '../src/services/api';

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
}));

jest.mock('../src/services/api', () => ({
  api: {
    signUp: jest.fn(),
    getOAuthUrl: jest.fn(),
    exchangeOAuthCallback: jest.fn(),
  },
}));

describe('SignUpScreen Component', () => {
  const mockOnSuccess = jest.fn();
  const mockOnNavigateToSignIn = jest.fn();
  const mockOnBackToMap = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);
  });

  test('renders email, password, confirm password, and Google button (no Facebook)', () => {
    const { getByTestId, queryByTestId } = render(
      <SignUpScreen
        onSuccess={mockOnSuccess}
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onBackToMap={mockOnBackToMap}
      />,
    );

    expect(getByTestId('signup-email-input')).toBeTruthy();
    expect(getByTestId('signup-password-input')).toBeTruthy();
    expect(getByTestId('signup-confirm-password-input')).toBeTruthy();
    expect(getByTestId('submit-signup-btn')).toBeTruthy();
    expect(getByTestId('google-signup-btn')).toBeTruthy();
    expect(queryByTestId('facebook-signup-btn')).toBeNull();
    expect(getByTestId('navigate-to-signin-btn')).toBeTruthy();
  });

  test('validates password length and password match', () => {
    const { getByTestId, getByText } = render(
      <SignUpScreen
        onSuccess={mockOnSuccess}
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onBackToMap={mockOnBackToMap}
      />,
    );

    // Short password
    fireEvent.changeText(getByTestId('signup-email-input'), 'test@cebu.gov');
    fireEvent.changeText(getByTestId('signup-password-input'), '123');
    fireEvent.changeText(getByTestId('signup-confirm-password-input'), '123');
    fireEvent.press(getByTestId('submit-signup-btn'));

    expect(getByText('Password must be at least 6 characters long.')).toBeTruthy();
    expect(api.signUp).not.toHaveBeenCalled();

    // Mismatched passwords
    fireEvent.changeText(getByTestId('signup-password-input'), 'password123');
    fireEvent.changeText(getByTestId('signup-confirm-password-input'), 'password456');
    fireEvent.press(getByTestId('submit-signup-btn'));

    expect(getByText('Passwords do not match.')).toBeTruthy();
    expect(api.signUp).not.toHaveBeenCalled();
  });

  test('calls api.signUp and calls onSuccess when user is returned', async () => {
    (api.signUp as jest.Mock).mockResolvedValueOnce({
      user: { id: 'usr-new', email: 'citizen@cebu.gov' },
    });

    const { getByTestId } = render(
      <SignUpScreen
        onSuccess={mockOnSuccess}
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onBackToMap={mockOnBackToMap}
      />,
    );

    fireEvent.changeText(getByTestId('signup-email-input'), 'citizen@cebu.gov');
    fireEvent.changeText(getByTestId('signup-password-input'), 'secret123');
    fireEvent.changeText(getByTestId('signup-confirm-password-input'), 'secret123');
    fireEvent.press(getByTestId('submit-signup-btn'));

    await waitFor(() => {
      expect(api.signUp).toHaveBeenCalledWith('citizen@cebu.gov', 'secret123');
      expect(mockOnSuccess).toHaveBeenCalledWith({
        id: 'usr-new',
        email: 'citizen@cebu.gov',
      });
    });
  });

  test('displays status message when email confirmation is required', async () => {
    (api.signUp as jest.Mock).mockResolvedValueOnce({
      user: null,
      message: 'Please check your email to confirm your account.',
    });

    const { getByTestId, getByText } = render(
      <SignUpScreen
        onSuccess={mockOnSuccess}
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onBackToMap={mockOnBackToMap}
      />,
    );

    fireEvent.changeText(getByTestId('signup-email-input'), 'unconfirmed@cebu.gov');
    fireEvent.changeText(getByTestId('signup-password-input'), 'secret123');
    fireEvent.changeText(getByTestId('signup-confirm-password-input'), 'secret123');
    fireEvent.press(getByTestId('submit-signup-btn'));

    await waitFor(() => {
      expect(getByTestId('signup-status-box')).toBeTruthy();
      expect(getByText('Please check your email to confirm your account.')).toBeTruthy();
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });
  });

  test('clicking Continue with Google initiates in-app modal popup flow', async () => {
    (api.getOAuthUrl as jest.Mock).mockResolvedValueOnce({
      url: 'https://ssgylyabytznsttvtyip.supabase.co/auth/v1/authorize?provider=google',
    });
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValueOnce({
      type: 'success',
      url: 'projecttrack://auth/callback#access_token=token-signup&refresh_token=refresh-signup',
    });
    (api.exchangeOAuthCallback as jest.Mock).mockResolvedValueOnce({
      user: { id: 'usr-google-signup', email: 'newuser@cebu.gov' },
    });

    const { getByTestId } = render(
      <SignUpScreen
        onSuccess={mockOnSuccess}
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onBackToMap={mockOnBackToMap}
      />,
    );

    fireEvent.press(getByTestId('google-signup-btn'));

    await waitFor(() => {
      expect(api.getOAuthUrl).toHaveBeenCalledWith('google', 'projecttrack://auth/callback');
      expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
        'https://ssgylyabytznsttvtyip.supabase.co/auth/v1/authorize?provider=google',
        'projecttrack://auth/callback',
      );
      expect(api.exchangeOAuthCallback).toHaveBeenCalledWith('token-signup', 'refresh-signup');
      expect(mockOnSuccess).toHaveBeenCalledWith({
        id: 'usr-google-signup',
        email: 'newuser@cebu.gov',
      });
    });
  });
});
