import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import App from '../App';

describe('App Root Component Navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders HomeScreen by default and navigates to SignIn, SignUp, and back', () => {
    const { getByText, getByTestId, queryByTestId } = render(<App />);

    // 1. Starts on HomeScreen
    expect(getByText('Reyal Or Pake')).toBeTruthy();
    expect(getByTestId('home-screen')).toBeTruthy();

    // 2. Navigate to Sign In
    const signInBtn = getByTestId('sign-in-nav-btn');
    fireEvent.press(signInBtn);

    // Should now show SignInScreen
    expect(getByTestId('signin-screen')).toBeTruthy();

    // 3. Navigate from SignIn to SignUp
    const createAccountBtn = getByTestId('navigate-to-signup-btn');
    fireEvent.press(createAccountBtn);

    // Should now show SignUpScreen
    expect(getByTestId('signup-screen')).toBeTruthy();

    // 4. Navigate from SignUp back to SignIn
    const toSignInBtn = getByTestId('navigate-to-signin-btn');
    fireEvent.press(toSignInBtn);

    expect(getByTestId('signin-screen')).toBeTruthy();

    // 5. Press Back to Map
    const backBtn = getByTestId('back-to-map-btn');
    fireEvent.press(backBtn);

    // Back to HomeScreen
    expect(getByTestId('home-screen')).toBeTruthy();
    expect(queryByTestId('signin-screen')).toBeNull();
  });

  test('navigates to Contractor Rankings and back to Home', () => {
    const { getByTestId, queryByTestId } = render(<App />);

    // Navigate to Contractors screen via header tab
    const contractorsBtn = getByTestId('nav-contractors-btn');
    fireEvent.press(contractorsBtn);

    // Should show ContractorRankingScreen
    expect(getByTestId('contractor-ranking-screen')).toBeTruthy();

    // Press Back to Map
    const backToMapBtn = getByTestId('back-to-map-btn');
    fireEvent.press(backToMapBtn);

    // Back to HomeScreen
    expect(getByTestId('home-screen')).toBeTruthy();
    expect(queryByTestId('contractor-ranking-screen')).toBeNull();
  });
});
