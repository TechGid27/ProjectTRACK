import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import SignInScreen from '../src/ui/screens/SignInScreen';

describe('SignInScreen Component', () => {
  const mockOnSuccess = jest.fn();
  const mockOnNavigateToSignUp = jest.fn();
  const mockOnBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders sign in fields, OAuth options, and strictly lacks role-based "I AM A" selector', () => {
    const { getByText, getByPlaceholderText, queryByText, getByTestId } = render(
      <SignInScreen
        onSuccess={mockOnSuccess}
        onNavigateToSignUp={mockOnNavigateToSignUp}
        onBack={mockOnBack}
      />,
    );

    // Header & Brand
    expect(getByText('Sign in')).toBeTruthy();
    expect(getByTestId('google-signin-btn')).toBeTruthy();
    expect(getByTestId('facebook-signin-btn')).toBeTruthy();
    expect(getByPlaceholderText('you@example.com')).toBeTruthy();
    expect(getByPlaceholderText('••••••••')).toBeTruthy();

    // STRICT PENTEST / SECURITY CHECK: Confirm role selector is removed
    expect(queryByText('I AM A')).toBeNull();
    expect(queryByText('Citizen Verifier')).toBeNull();
    expect(queryByText('COA / Auditor')).toBeNull();
    expect(queryByText('Contractor')).toBeNull();
  });

  test('shows validation error when submitting with empty credentials', () => {
    const { getByText, getByTestId } = render(
      <SignInScreen
        onSuccess={mockOnSuccess}
        onNavigateToSignUp={mockOnNavigateToSignUp}
        onBack={mockOnBack}
      />,
    );

    const submitBtn = getByTestId('submit-signin-btn');
    fireEvent.press(submitBtn);

    expect(getByText('Please enter your email and password.')).toBeTruthy();
    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  test('calls onSuccess with credentials when valid', () => {
    const { getByPlaceholderText, getByTestId } = render(
      <SignInScreen
        onSuccess={mockOnSuccess}
        onNavigateToSignUp={mockOnNavigateToSignUp}
        onBack={mockOnBack}
      />,
    );

    const emailInput = getByPlaceholderText('you@example.com');
    const passInput = getByPlaceholderText('••••••••');

    fireEvent.changeText(emailInput, 'citizen@cebu.gov.ph');
    fireEvent.changeText(passInput, 'securepassword123');

    const submitBtn = getByTestId('submit-signin-btn');
    fireEvent.press(submitBtn);

    expect(mockOnSuccess).toHaveBeenCalledWith({
      email: 'citizen@cebu.gov.ph',
    });
  });

  test('pressing back button triggers onBack callback', () => {
    const { getByTestId } = render(
      <SignInScreen
        onSuccess={mockOnSuccess}
        onNavigateToSignUp={mockOnNavigateToSignUp}
        onBack={mockOnBack}
      />,
    );

    const backBtn = getByTestId('back-to-map-btn');
    fireEvent.press(backBtn);

    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  test('pressing "Create an account" triggers onNavigateToSignUp callback', () => {
    const { getByTestId } = render(
      <SignInScreen
        onSuccess={mockOnSuccess}
        onNavigateToSignUp={mockOnNavigateToSignUp}
        onBack={mockOnBack}
      />,
    );

    const signUpLink = getByTestId('navigate-to-signup-btn');
    fireEvent.press(signUpLink);

    expect(mockOnNavigateToSignUp).toHaveBeenCalledTimes(1);
  });
});
