import { PaneDescriptor, PaneSize, PaneState } from '../types';

// Pure helpers for the `pane_size` protocol frame. Kept free of any React
// Native imports so they can be unit-tested under node/tsx.

/**
 * Monospace advance width as a fraction of font size. Menlo (iOS default
 * monospace) is ≈0.6em per cell; we use that to translate a desired column
 * count into a font size that exactly spans an available pixel width.
 */
const MONO_ADVANCE_RATIO = 0.6;

/** Default render font size when no desktop size is known yet. */
export const BASE_TERMINAL_FONT = 12;
/** Floor so a very wide desktop grid stays legible-ish rather than vanishing. */
export const MIN_TERMINAL_FONT = 4;

/**
 * Font size at which `cols` monospace cells span `availableWidth` pixels — the
 * React Native analogue of scaling an xterm canvas to fit the device. The size
 * is dictated by the desktop's grid, not the phone, so this only ever shrinks
 * below the base font (never enlarges past it). Falls back to the base font for
 * missing/degenerate inputs.
 */
export function fitTerminalFontSize(
  availableWidth: number,
  cols: number,
  base: number = BASE_TERMINAL_FONT,
  min: number = MIN_TERMINAL_FONT,
): number {
  if (!availableWidth || !cols || cols <= 0) return base;
  const fit = availableWidth / (cols * MONO_ADVANCE_RATIO);
  return Math.max(min, Math.min(base, fit));
}

/**
 * Returns panes with `paneId`'s `ptySize` set to `size`. No-op (same reference)
 * when the pane isn't mounted yet — callers buffer the size separately and
 * re-apply it at pane creation (see {@link createPaneState}) — or when the size
 * is unchanged.
 */
export function attachPaneSize(
  panes: Record<string, PaneState>,
  paneId: string,
  size: PaneSize,
): Record<string, PaneState> {
  const pane = panes[paneId];
  if (!pane) return panes;
  if (pane.ptySize && pane.ptySize.cols === size.cols && pane.ptySize.rows === size.rows) {
    return panes;
  }
  return { ...panes, [paneId]: { ...pane, ptySize: size } };
}

/**
 * Builds a fresh PaneState for a newly-listed pane, applying any size that
 * arrived (and was buffered) before this pane appeared in `pane_list`.
 */
export function createPaneState(
  descriptor: PaneDescriptor,
  opts: { active: boolean; size: PaneSize | null; now: number },
): PaneState {
  return {
    descriptor,
    streamingState: opts.active ? 'streaming' : 'minimized',
    outputBuffer: '',
    sessionState: null,
    ptySize: opts.size,
    hasUserRequest: false,
    lastUserRequestAt: null,
    lastActivityAt: opts.now,
  };
}
