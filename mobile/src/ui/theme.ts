/**
 * Shared UI sizing tokens.
 *
 * MIN_TOUCH is the minimum recommended touch-target edge length. Apple's Human
 * Interface Guidelines recommend 44pt and Material Design recommends 48dp; 44 is
 * the common floor we standardize interactive controls to so every tappable
 * element is comfortable on a phone.
 */
export const MIN_TOUCH = 44;

/** Convenience style fragment to enforce a square minimum touch target. */
export const minTouchTarget = {
  minWidth: MIN_TOUCH,
  minHeight: MIN_TOUCH,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};
