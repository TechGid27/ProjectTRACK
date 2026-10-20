import { Platform } from 'react-native';

/**
 * Cross-platform micro-haptics service.
 * Provides subtle tactile feedback on mobile devices while gracefully no-opping on Web.
 */
class HapticsService {
  triggerLightImpact() {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(10);
      }
    } catch {
      // ignore
    }
  }

  triggerSelection() {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(15);
      }
    } catch {
      // ignore
    }
  }

  triggerSuccess() {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([20, 40, 20]);
      }
    } catch {
      // ignore
    }
  }

  triggerWarning() {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([50, 30, 50]);
      }
    } catch {
      // ignore
    }
  }
}

export const haptics = new HapticsService();
