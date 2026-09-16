// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Copy for the error codes the sign-in and account-security endpoints
 * return. The server's own message is used when a code has no override.
 */

const MESSAGES: Record<string, string> = {
  INVALID_CODE: 'That code is not valid. Check your authenticator app and try again.',
  RATE_LIMITED: 'Too many attempts. Please wait 15 minutes and try again.',
  MFA_TOKEN_EXPIRED: 'Your sign-in timed out. Please sign in again.',
  MFA_REQUIRED: 'Your sign-in timed out. Please sign in again.',
  INVALID_CREDENTIALS: 'Invalid username or password.',
  LAST_FACTOR_REQUIRED: 'Your firm requires two-factor authentication. Set up another method before removing this one.',
  PASSKEYS_UNAVAILABLE: 'Passkeys are not available on this server yet. Ask an admin to set the public app URL.',
  INVALID_CHALLENGE: 'That request expired. Please try again.',
  NETWORK_ERROR: 'Cannot reach the server. Check your connection and try again.',
  LOCAL_LOGIN_DISABLED: 'Password sign-in is turned off for this product. Use single sign-on.',
};

/**
 * On the second-factor step a plain 401 means the 5-minute token lapsed, so it
 * reads as a timeout rather than a generic "unauthorized".
 */
export function messageForAuthError(code: string, fallback: string, opts: { onMfaStep?: boolean } = {}): string {
  if (opts.onMfaStep && code === 'UNAUTHORIZED') return MESSAGES.MFA_TOKEN_EXPIRED;
  return MESSAGES[code] ?? fallback;
}

/** Codes after which the MFA step cannot continue and the user must start over. */
export function isMfaTerminal(code: string): boolean {
  return code === 'UNAUTHORIZED' || code === 'MFA_TOKEN_EXPIRED' || code === 'MFA_REQUIRED' || code === 'MFA_STAGE_REQUIRED';
}
