import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import App from '../App';

describe('App Root Navigation & Bottom Navigation Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders HomeScreen and BottomTabBar by default, switches tabs via BottomTabBar', () => {
    const { getByTestId, queryByTestId } = render(<App />);

    // 1. Starts on HomeScreen with BottomTabBar
    expect(getByTestId('home-screen')).toBeTruthy();
    expect(getByTestId('bottom-tab-bar')).toBeTruthy();

    // 2. Tap Center Map tab -> switches to MapScreen
    const mapTab = getByTestId('nav-tab-map');
    fireEvent.press(mapTab);

    expect(getByTestId('map-screen')).toBeTruthy();
    expect(queryByTestId('home-screen')).toBeNull();

    // 3. Tap Contractors tab -> switches to ContractorRankingScreen
    const contractorsTab = getByTestId('nav-tab-contractors');
    fireEvent.press(contractorsTab);

    expect(getByTestId('contractor-ranking-screen')).toBeTruthy();
    expect(queryByTestId('map-screen')).toBeNull();

    // 4. Tap Home tab -> returns to HomeScreen
    const homeTab = getByTestId('nav-tab-home');
    fireEvent.press(homeTab);

    expect(getByTestId('home-screen')).toBeTruthy();
    expect(queryByTestId('contractor-ranking-screen')).toBeNull();
  });

  test('navigates to SignIn, SignUp, and back to main app flow', () => {
    const { getByTestId, queryByTestId } = render(<App />);

    // 1. Navigate to Sign In from home screen
    const signInBtn = getByTestId('sign-in-nav-btn');
    fireEvent.press(signInBtn);

    // Should now show SignInScreen without bottom tab bar
    expect(getByTestId('signin-screen')).toBeTruthy();
    expect(queryByTestId('bottom-tab-bar')).toBeNull();

    // 2. Navigate from SignIn to SignUp
    const createAccountBtn = getByTestId('navigate-to-signup-btn');
    fireEvent.press(createAccountBtn);

    expect(getByTestId('signup-screen')).toBeTruthy();

    // 3. Navigate from SignUp back to SignIn
    const toSignInBtn = getByTestId('navigate-to-signin-btn');
    fireEvent.press(toSignInBtn);

    expect(getByTestId('signin-screen')).toBeTruthy();

    // 4. Press Back from SignIn -> returns to main app
    const backBtn = getByTestId('back-to-map-btn');
    fireEvent.press(backBtn);

    expect(getByTestId('home-screen')).toBeTruthy();
    expect(getByTestId('bottom-tab-bar')).toBeTruthy();
    expect(queryByTestId('signin-screen')).toBeNull();
  });
});
