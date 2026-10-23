import React from 'react';
import {
  Image,
  StyleSheet,
  ImageStyle,
  StyleProp,
  useColorScheme,
} from 'react-native';

// Bundled ProjectTRACK brand marks.
//  • logo.png       -> dark mark, for LIGHT backgrounds / light mode
//  • logo-light.png -> light mark, for DARK backgrounds / dark mode
const LOGO_DARK = require('../../assets/logo.png');
const LOGO_LIGHT = require('../../assets/logo-light.png');

export type LogoVariant = 'auto' | 'light' | 'dark';

export interface LogoProps {
  /** Rendered width & height in px (square). Defaults to 28. */
  size?: number;
  /**
   * Which mark to show:
   *  • 'auto'  -> follow the system color scheme (light mark in dark mode)
   *  • 'light' -> always the light mark (use on dark surfaces/headers)
   *  • 'dark'  -> always the dark mark (use on light surfaces)
   * Defaults to 'auto'.
   */
  variant?: LogoVariant;
  style?: StyleProp<ImageStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

/**
 * ProjectTRACK logo image. Centralizes the brand asset and swaps to the light
 * mark on dark backgrounds (or in system dark mode) so it stays visible.
 */
export default function Logo({
  size = 28,
  variant = 'auto',
  style,
  testID = 'app-logo',
  accessibilityLabel = 'ProjectTRACK logo',
}: LogoProps) {
  const scheme = useColorScheme();
  const useLightMark =
    variant === 'light' || (variant === 'auto' && scheme === 'dark');
  const source = useLightMark ? LOGO_LIGHT : LOGO_DARK;

  return (
    <Image
      source={source}
      style={[styles.logo, { width: size, height: size }, style]}
      resizeMode="contain"
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    backgroundColor: 'transparent',
  },
});
