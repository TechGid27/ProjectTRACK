import React from 'react';
import { render } from '@testing-library/react-native';
import * as RN from 'react-native';
import Logo from '../src/ui/components/Logo';

const DARK_MARK = require('../src/assets/logo.png');
const LIGHT_MARK = require('../src/assets/logo-light.png');

describe('Logo', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('renders with default testID and accessibility label', () => {
    const { getByTestId } = render(<Logo />);
    const logo = getByTestId('app-logo');
    expect(logo).toBeTruthy();
    expect(logo.props.accessibilityLabel).toBe('ProjectTRACK logo');
  });

  test('applies a custom square size', () => {
    const { getByTestId } = render(<Logo size={48} testID="custom-logo" />);
    const logo = getByTestId('custom-logo');
    const flat = Array.isArray(logo.props.style)
      ? Object.assign({}, ...logo.props.style.flat())
      : logo.props.style;
    expect(flat.width).toBe(48);
    expect(flat.height).toBe(48);
  });

  test('variant="light" renders the light mark (for dark surfaces)', () => {
    const { getByTestId } = render(<Logo variant="light" testID="l" />);
    expect(getByTestId('l').props.source).toBe(LIGHT_MARK);
  });

  test('variant="dark" renders the dark mark (for light surfaces)', () => {
    const { getByTestId } = render(<Logo variant="dark" testID="d" />);
    expect(getByTestId('d').props.source).toBe(DARK_MARK);
  });

  test('variant="auto" switches to the light mark in system dark mode', () => {
    jest.spyOn(RN, 'useColorScheme').mockReturnValue('dark');
    const { getByTestId } = render(<Logo variant="auto" testID="a-dark" />);
    expect(getByTestId('a-dark').props.source).toBe(LIGHT_MARK);
  });

  test('variant="auto" uses the dark mark in system light mode', () => {
    jest.spyOn(RN, 'useColorScheme').mockReturnValue('light');
    const { getByTestId } = render(<Logo variant="auto" testID="a-light" />);
    expect(getByTestId('a-light').props.source).toBe(DARK_MARK);
  });
});
