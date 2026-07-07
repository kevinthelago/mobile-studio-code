// Pure input-gate decision for the SessionChat input bar (#219). The desktop
// enforces the real gate — `pane_input` is silently dropped until the user
// grants input control there (view-only posture) — so this module only decides
// what the PHONE can honestly show. No React Native imports (tsx-testable).

/**
 * What the phone knows about the desktop's input grant.
 * - `true` / `false`: an explicit grant signal off the wire —
 *   `auth_ok.inputGranted` (connect-time) + `input_grant_changed` (live
 *   toggles), base-studio-code#2511.
 * - `null`: unknown — a pre-#2511 desktop never signals it, so input stays
 *   enabled and a hint surfaces only after an attempt (that desktop drops
 *   ungranted keystrokes without an error).
 */
export type InputGrant = boolean | null;

export type InputGateStatus = 'ready' | 'unconfirmed' | 'view-only' | 'offline';

export type InputGateDecision = {
  status: InputGateStatus;
  /** Whether the text input accepts typing / submits. */
  editable: boolean;
  /** Hint line rendered above the input bar; null = show nothing. */
  hint: string | null;
};

export const VIEW_ONLY_HINT =
  'View-only — grant input control on the desktop to drive this session.';

export const UNCONFIRMED_HINT =
  'Not running? A new device is view-only — grant input control on the desktop.';

export const OFFLINE_HINT = 'Reconnect to your desktop to send input.';

/**
 * Decide the input bar's state.
 *
 * @param connected  the tunnel session is established (auth_ok reached).
 * @param inputGranted  the grant signal, if any (see {@link InputGrant}).
 * @param attempted  the user has submitted at least one line this view — the
 *   unknown-grant hint only surfaces after an attempt, so a granted device
 *   isn't nagged pre-emptively.
 */
export function decideInputGate(opts: {
  connected: boolean;
  inputGranted: InputGrant;
  attempted: boolean;
}): InputGateDecision {
  if (!opts.connected) {
    return { status: 'offline', editable: false, hint: OFFLINE_HINT };
  }
  if (opts.inputGranted === false) {
    return { status: 'view-only', editable: false, hint: VIEW_ONLY_HINT };
  }
  if (opts.inputGranted === true) {
    return { status: 'ready', editable: true, hint: null };
  }
  return {
    status: 'unconfirmed',
    editable: true,
    hint: opts.attempted ? UNCONFIRMED_HINT : null,
  };
}
