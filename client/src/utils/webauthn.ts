// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Pure helpers around the browser's passkey support and the errors a WebAuthn
 * ceremony can throw. Components pass in the environment so this is testable.
 */

export interface WebAuthnAvailability {
  supported: boolean;
  reason?: string;
}

export function webauthnAvailability(env: { hasPublicKeyCredential: boolean; isSecureContext: boolean }): WebAuthnAvailability {
  if (!env.hasPublicKeyCredential) {
    return { supported: false, reason: 'This browser does not support passkeys. Try a current version of Chrome, Edge, Safari or Firefox.' };
  }
  if (!env.isSecureContext) {
    return { supported: false, reason: 'Passkeys only work over https (or on localhost). Open the app at its https address.' };
  }
  return { supported: true };
}

export interface WebAuthnErrorInfo {
  /** The user dismissed or timed out the browser prompt — not a failure to shout about. */
  cancelled: boolean;
  message: string;
}

/**
 * Map a thrown value from startRegistration / startAuthentication to copy.
 * SimpleWebAuthn wraps DOMExceptions in a WebAuthnError carrying `code`; a raw
 * DOMException (or anything else) is handled by name.
 */
export function describeWebAuthnError(err: unknown): WebAuthnErrorInfo {
  const e = err as { code?: string; name?: string; message?: string } | null;
  const code = e?.code;
  const name = e?.name;

  switch (code) {
    case 'ERROR_CEREMONY_ABORTED':
      return { cancelled: true, message: 'No passkey was used.' };
    case 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED':
      return { cancelled: false, message: 'This device already has a passkey for your account. Use it to sign in, or remove it first.' };
    case 'ERROR_INVALID_DOMAIN':
    case 'ERROR_INVALID_RP_ID':
      return { cancelled: false, message: 'The app\'s public URL does not match the address in your browser. Ask an admin to check Settings → Sign-in security.' };
    case 'ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT':
      return { cancelled: false, message: 'This security key cannot store a passkey. Use a newer key, or your phone or computer.' };
    case 'ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT':
      return { cancelled: false, message: 'This authenticator cannot verify you (no PIN or biometric). Use a different device.' };
    case 'ERROR_AUTHENTICATOR_GENERAL_ERROR':
      return { cancelled: false, message: 'Your device reported an error. Try again.' };
    default:
      break;
  }

  switch (name) {
    case 'NotAllowedError':
    case 'AbortError':
      return { cancelled: true, message: 'No passkey was used.' };
    case 'SecurityError':
      return { cancelled: false, message: 'Passkeys need https and a public URL that matches this address. Ask an admin to check Settings → Sign-in security.' };
    case 'InvalidStateError':
      return { cancelled: false, message: 'This device already has a passkey for your account.' };
    case 'NotSupportedError':
      return { cancelled: false, message: 'This browser or device does not support passkeys.' };
    default:
      return { cancelled: false, message: e?.message || 'The passkey request failed. Try again.' };
  }
}
