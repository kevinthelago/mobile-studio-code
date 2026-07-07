// Pure keyboard-avoidance math for the SessionChat input bar (#219). Reuses
// the old Run-tab approach (commit c97cdce "keep tunneled terminal input flush
// above the keyboard/tab bar"): track the keyboard height directly and pad the
// input wrap's bottom so it sits just above whichever of keyboard / home
// indicator is in play. No React Native imports (tsx-testable).

/**
 * Bottom padding for the terminal input wrap.
 *
 * Keyboard DOWN: only the base gap plus the safe-area inset (home indicator)
 * is needed — `safeAreaBottom` is 0 on screens where the navigator already
 * reserves that space below the content (the old tab-bar case).
 *
 * Keyboard UP: the keyboard height is measured from the physical screen bottom
 * (it covers the home indicator), so lift by the part of the keyboard that
 * rises above whatever space is already reserved below the content
 * (`reservedBelow`, e.g. an in-flow tab bar; 0 on a full-screen stack page).
 */
export function inputBottomPadding(opts: {
  keyboardHeight: number;
  /** Space the navigator already reserves below the content (tab bar etc.). */
  reservedBelow: number;
  /** Bottom safe-area inset to clear when the keyboard is down. */
  safeAreaBottom: number;
  base?: number;
}): number {
  const base = opts.base ?? 8;
  if (opts.keyboardHeight <= 0) return base + opts.safeAreaBottom;
  return Math.max(base, opts.keyboardHeight - opts.reservedBelow + base);
}
