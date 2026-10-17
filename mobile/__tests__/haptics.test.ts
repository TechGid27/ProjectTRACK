import { haptics } from '../src/services/haptics';

describe('HapticsService', () => {
  test('invokes trigger methods without throwing exceptions across platforms', () => {
    expect(() => haptics.triggerLightImpact()).not.toThrow();
    expect(() => haptics.triggerSelection()).not.toThrow();
    expect(() => haptics.triggerSuccess()).not.toThrow();
    expect(() => haptics.triggerWarning()).not.toThrow();
  });
});
