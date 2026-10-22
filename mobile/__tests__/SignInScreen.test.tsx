import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import SignInScreen from '../src/ui/screens/SignInScreen';
import { api } from '../src/services/api';

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
}));

jest.mock('../src/services/api', () => ({
  api: {
    signIn: jest.fn(),
    getOAuthUrl: jest.fn(),
    exchangeOAuthCallback: jest.fn(),
  },
}));

describe('SignInScreen Component', () => {
  const mockOnSuccess = jest.fn();
  const mockOnNavigateToSignUp = jest.fn();
  const mockOnBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);
  });

  test('renders email/password inputs, sign-in button, and Google sign-in button (no Facebook)', () => {
    const { getByTestId, queryByTestId } = render(
      <SignInScreen
        onSuccess={mockOnSuccess}
        onNavigateToSignUp={mockOnNavigateToSignUp}
        onBack={mockOnBack}
      />,
    );

    expect(getByTestId('signin-email-input')).toBeTruthy();
    expect(getByTestId('signin-password-input')).toBeTruthy();
    expect(getByTestId('submit-signin-btn')).toBeTruthy();
    expect(getByTestId('google-signin-btn')).toBeTruthy();
    expect(queryByTestId('facebook-signin-btn')).toBeNull();
    expect(getByTestId('back-to-map-btn')).toBeTruthy();
    expect(getByTestId('navigate-to-signup-btn')).toBeTruthy();
  });

  test('shows error when email or password is empty', () => {
    const { getByTestId, getByText } = render(
      <SignInScreen
        onSuccess={mockOnSuccess}
        onNavigateToSignUp={mockOnNavigateToSignUp}
        onBack={mockOnBack}
      />,
    );

    const submitBtn = getByTestId('submit-signin-btn');
    fireEvent.press(submitBtn);

    expect(getByTestId('signin-error-box')).toBeTruthy();
    expect(getByText('Please enter your email and password.')).toBeTruthy();
    expect(api.signIn).not.toHaveBeenCalled();
    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  test('calls api.signIn on submit and calls onSuccess on success', async () => {
    (api.signIn as jest.Mock).mockResolvedValueOnce({
      user: { id: 'usr-1', email: 'citizen@cebu.gov' },
    });

    const { getByTestId } = render(
      <SignInScreen
        onSuccess={mockOnSuccess}
        onNavigateToSignUp={mockOnNavigateToSignUp}
        onBack={mockOnBack}
      />,
    );

    fireEvent.changeText(getByTestId('signin-email-input'), 'citizen@cebu.gov');
    fireEvent.changeText(getByTestId('signin-password-input'), 'Password123!');
    fireEvent.press(getByTestId('submit-signin-btn'));

    await waitFor(() => {
      expect(api.signIn).toHaveBeenCalledWith('citizen@cebu.gov', 'Password123!');
      expect(mockOnSuccess).toHaveBeenCalledWith({
        id: 'usr-1',
        email: 'citizen@cebu.gov',
      });
    });
  });

  test('displays error message when api.signIn returns an error', async () => {
    (api.signIn as jest.Mock).mockResolvedValueOnce({
      user: null,
      error: 'Invalid email or password.',
    });

    const { getByTestId, getByText } = render(
      <SignInScreen
        onSuccess={mockOnSuccess}
        onNavigateToSignUp={mockOnNavigateToSignUp}
        onBack={mockOnBack}
      />,
    );

    fireEvent.changeText(getByTestId('signin-email-input'), 'unknown@cebu.gov');
    fireEvent.changeText(getByTestId('signin-password-input'), 'wrongpassword');
    fireEvent.press(getByTestId('submit-signin-btn'));

    await waitFor(() => {
      expect(getByTestId('signin-error-box')).toBeTruthy();
      expect(getByText('Invalid email or password.')).toBeTruthy();
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });
  });

  test('clicking Continue with Google opens in-app popup modal session and exchanges callback tokens', async () => {
    (api.getOAuthUrl as jest.Mock).mockResolvedValueOnce({
      url: 'https://ssgylyabytznsttvtyip.supabase.co/auth/v1/authorize?provider=google',
    });
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValueOnce({
      type: 'success',
      url: 'projecttrack://auth/callback#access_token=token-abc&refresh_token=refresh-xyz',
    });
    (api.exchangeOAuthCallback as jest.Mock).mockResolvedValueOnce({
      user: { id: 'google-usr-1', email: 'citizen.google@cebu.gov' },
    });

    const { getByTestId } = render(
      <SignInScreen
        onSuccess={mockOnSuccess}
        onNavigateToSignUp={mockOnNavigateToSignUp}
        onBack={mockOnBack}
      />,
    );

    fireEvent.press(getByTestId('google-signin-btn'));

    await waitFor(() => {
      expect(api.getOAuthUrl).toHaveBeenCalledWith('google', 'projecttrack://auth/callback');
      expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
        'https://ssgylyabytznsttvtyip.supabase.co/auth/v1/authorize?provider=google',
        'projecttrack://auth/callback',
      );
      expect(api.exchangeOAuthCallback).toHaveBeenCalledWith('token-abc', 'refresh-xyz');
      expect(mockOnSuccess).toHaveBeenCalledWith({
        id: 'google-usr-1',
        email: 'citizen.google@cebu.gov',
      });
    });
  });

  test('handles user canceling in-app Google sign-in gracefully', async () => {
    (api.getOAuthUrl as jest.Mock).mockResolvedValueOnce({
      url: 'https://ssgylyabytznsttvtyip.supabase.co/auth/v1/authorize?provider=google',
    });
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValueOnce({
      type: 'cancel',
    });

    const { getByTestId } = render(
      <SignInScreen
        onSuccess={mockOnSuccess}
        onNavigateToSignUp={mockOnNavigateToSignUp}
        onBack={mockOnBack}
      />,
    );

    fireEvent.press(getByTestId('google-signin-btn'));

    await waitFor(() => {
      expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalled();
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });
  });
});
