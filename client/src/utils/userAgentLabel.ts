// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * "Chrome on Windows", "Safari on iPhone" — enough for a user to tell their
 * remembered browsers and passkeys apart. Deliberately rough; the raw string
 * is kept in a tooltip.
 */
export function describeUserAgent(ua: string | null | undefined): string {
  const s = String(ua ?? '');
  if (!s) return 'Unknown browser';

  let os = 'Unknown OS';
  if (/iPhone/.test(s)) os = 'iPhone';
  else if (/iPad/.test(s)) os = 'iPad';
  else if (/Android/.test(s)) os = 'Android';
  else if (/Windows/.test(s)) os = 'Windows';
  else if (/Mac OS X|Macintosh/.test(s)) os = 'Mac';
  else if (/CrOS/.test(s)) os = 'ChromeOS';
  else if (/Linux/.test(s)) os = 'Linux';

  let browser = 'Browser';
  if (/Edg\//.test(s)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(s)) browser = 'Opera';
  else if (/Firefox\//.test(s)) browser = 'Firefox';
  else if (/Chrome\//.test(s) || /CriOS\//.test(s)) browser = 'Chrome';
  else if (/Safari\//.test(s)) browser = 'Safari';

  return `${browser} on ${os}`;
}
