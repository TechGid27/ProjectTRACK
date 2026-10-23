import React from 'react';
import { Image, StyleSheet, ImageStyle, StyleProp } from 'react-native';

// Bundled ProjectTRACK brand mark (sourced from the web app's logo).
const LOGO_SOURCE = require('../../assets/logo.png');

export interface LogoProps {
  /** Rendered width & height in px (square). Defaults to 28. */
  size?: number;
  style?: StyleProp<ImageStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

/**
 * ProjectTRACK logo image. Centralizes the brand asset so headers, splash
 * stand-ins, and future surfaces all reference a single source.
 */
export default function Logo({
  size = 28,
  style,
  testID = 'app-logo',
  accessibilityLabel = 'ProjectTRACK logo',
}: LogoProps) {
  return (
    <Image
      source={LOGO_SOURCE}
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
    // Keep the mark crisp against dark headers.
    backgroundColor: 'transparent',
  },
});
