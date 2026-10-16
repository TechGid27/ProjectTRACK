import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import App from '../App';

describe('App Root Component', () => {
  test('renders HomeScreen by default and navigates to SignIn and back', () => {
    const { getByText, queryByText } = render(<App />);

    // Starts on HomeScreen
    expect(getByText('Reyal Or Pake')).toBeTruthy();

    // Navigate to Sign In
    const signInBtn = getByText('Sign In');
    fireEvent.press(signInBtn);

    // Should now show SignInScreen
    expect(getByText('Public Infrastructure Verification')).toBeTruthy();

    // Press Back to Map
    const backBtn = getByText('← Back to Map');
    fireEvent.press(backBtn);

    // Back to HomeScreen
    expect(getByText('Reyal Or Pake')).toBeTruthy();
    expect(queryByText('Public Infrastructure Verification')).toBeNull();
  });
});
