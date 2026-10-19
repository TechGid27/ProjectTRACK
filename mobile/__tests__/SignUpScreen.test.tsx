import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import SignUpScreen from '../src/ui/screens/SignUpScreen';

describe('SignUpScreen Component', () => {
  const mockOnSuccess = jest.fn();
  const mockOnNavigateToSignIn = jest.fn();
  const mockOnBackToMap = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('renders registration fields, social buttons, and back action', () => {
    const { getByText, getByTestId } = render(
      <SignUpScreen
        onSuccess={mockOnSuccess}
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onBackToMap={mockOnBackToMap}
      />,
    );

    expect(getByText('Create account')).toBeTruthy();
    expect(getByTestId('google-signup-btn')).toBeTruthy();
    expect(getByTestId('facebook-signup-btn')).toBeTruthy();
    expect(getByTestId('signup-email-input')).toBeTruthy();
    expect(getByTestId('signup-password-input')).toBeTruthy();
    expect(getByTestId('signup-confirm-password-input')).toBeTruthy();
  });

  test('shows error when submitting empty fields', () => {
    const { getByTestId, getByText } = render(
      <SignUpScreen
        onSuccess={mockOnSuccess}
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onBackToMap={mockOnBackToMap}
      />,
    );

    const submitBtn = getByTestId('submit-signup-btn');
    fireEvent.press(submitBtn);

    expect(getByText('Please enter email and password.')).toBeTruthy();
    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  test('shows error when password is less than 6 characters', () => {
    const { getByTestId, getByText } = render(
      <SignUpScreen
        onSuccess={mockOnSuccess}
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onBackToMap={mockOnBackToMap}
      />,
    );

    fireEvent.changeText(getByTestId('signup-email-input'), 'user@test.com');
    fireEvent.changeText(getByTestId('signup-password-input'), '12345');
    fireEvent.changeText(getByTestId('signup-confirm-password-input'), '12345');

    fireEvent.press(getByTestId('submit-signup-btn'));

    expect(getByText('Password must be at least 6 characters long.')).toBeTruthy();
    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  test('shows error when passwords do not match', () => {
    const { getByTestId, getByText } = render(
      <SignUpScreen
        onSuccess={mockOnSuccess}
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onBackToMap={mockOnBackToMap}
      />,
    );

    fireEvent.changeText(getByTestId('signup-email-input'), 'user@test.com');
    fireEvent.changeText(getByTestId('signup-password-input'), 'secret123');
    fireEvent.changeText(getByTestId('signup-confirm-password-input'), 'different123');

    fireEvent.press(getByTestId('submit-signup-btn'));

    expect(getByText('Passwords do not match.')).toBeTruthy();
    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  test('successfully submits and notifies onSuccess when inputs are valid', () => {
    const { getByTestId, getByText } = render(
      <SignUpScreen
        onSuccess={mockOnSuccess}
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onBackToMap={mockOnBackToMap}
      />,
    );

    fireEvent.changeText(getByTestId('signup-email-input'), 'auditor@cebu.gov.ph');
    fireEvent.changeText(getByTestId('signup-password-input'), 'validpass123');
    fireEvent.changeText(getByTestId('signup-confirm-password-input'), 'validpass123');

    fireEvent.press(getByTestId('submit-signup-btn'));

    expect(getByText('Account created! Logging you in…')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(mockOnSuccess).toHaveBeenCalledWith({
      email: 'auditor@cebu.gov.ph',
    });
  });

  test('tapping sign in link invokes onNavigateToSignIn', () => {
    const { getByTestId } = render(
      <SignUpScreen
        onSuccess={mockOnSuccess}
        onNavigateToSignIn={mockOnNavigateToSignIn}
        onBackToMap={mockOnBackToMap}
      />,
    );

    fireEvent.press(getByTestId('navigate-to-signin-btn'));
    expect(mockOnNavigateToSignIn).toHaveBeenCalledTimes(1);
  });
});
