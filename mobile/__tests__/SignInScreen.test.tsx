import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import SignInScreen from '../src/ui/screens/SignInScreen';

describe('SignInScreen Component', () => {
  const mockOnSuccess = jest.fn();
  const mockOnBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders sign in fields, roles, and back button', () => {
    const { getByText, getByPlaceholderText } = render(
      <SignInScreen onSuccess={mockOnSuccess} onBack={mockOnBack} />,
    );

    expect(getByText('ProjectTRACK')).toBeTruthy();
    expect(getByText('Public Infrastructure Verification')).toBeTruthy();
    expect(getByPlaceholderText('Enter email or username')).toBeTruthy();
    expect(getByPlaceholderText('Enter password')).toBeTruthy();
    expect(getByText('Citizen Verifier')).toBeTruthy();
    expect(getByText('COA / Auditor')).toBeTruthy();
    expect(getByText('Contractor')).toBeTruthy();
  });

  test('shows validation error when submitting with empty credentials', () => {
    const { getByText } = render(
      <SignInScreen onSuccess={mockOnSuccess} onBack={mockOnBack} />,
    );

    const signInBtn = getByText('Sign In to Account');
    fireEvent.press(signInBtn);

    expect(getByText('Please enter your email and password.')).toBeTruthy();
    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  test('calls onSuccess with credentials and selected role when valid', () => {
    const { getByText, getByPlaceholderText } = render(
      <SignInScreen onSuccess={mockOnSuccess} onBack={mockOnBack} />,
    );

    // Select role "COA / Auditor"
    const roleBtn = getByText('COA / Auditor');
    fireEvent.press(roleBtn);

    // Enter email and password
    const emailInput = getByPlaceholderText('Enter email or username');
    const passInput = getByPlaceholderText('Enter password');

    fireEvent.changeText(emailInput, 'auditor@coa.gov.ph');
    fireEvent.changeText(passInput, 'securepassword123');

    const signInBtn = getByText('Sign In to Account');
    fireEvent.press(signInBtn);

    expect(mockOnSuccess).toHaveBeenCalledWith({
      email: 'auditor@coa.gov.ph',
      role: 'COA / Auditor',
    });
  });

  test('calls onBack when back button is pressed', () => {
    const { getByText } = render(
      <SignInScreen onSuccess={mockOnSuccess} onBack={mockOnBack} />,
    );

    const backBtn = getByText('← Back to Map');
    fireEvent.press(backBtn);

    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });
});
