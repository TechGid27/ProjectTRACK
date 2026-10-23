import React from 'react';
import { render } from '@testing-library/react-native';
import Logo from '../src/ui/components/Logo';

describe('Logo', () => {
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
});
