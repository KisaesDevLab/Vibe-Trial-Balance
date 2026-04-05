// Copyright 2025-2026 Kisaes LLC
// Licensed under the Elastic License 2.0 (ELv2); you may not use this file
// except in compliance with the Elastic License 2.0.
// See LICENSE file in the project root for full license text.

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.ENCRYPTION_KEY) {
  console.error('\nFATAL: ENCRYPTION_KEY environment variable is required in production.');
  console.error('Set a unique value separate from JWT_SECRET for defense-in-depth.\n');
  process.exit(1);
}

if (!isProduction && !process.env.ENCRYPTION_KEY) {
  console.warn('⚠️  ENCRYPTION_KEY not set — falling back to JWT_SECRET. Set ENCRYPTION_KEY for production.');
}

/**
 * Derives a 32-byte key from the ENCRYPTION_KEY env var (or falls back to JWT_SECRET in dev).
 * Uses SHA-256 so the key length is always correct regardless of input length.
 */
function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || '';
  if (!raw) {
    throw new Error('No encryption key available (set ENCRYPTION_KEY or JWT_SECRET)');
  }
  return createHash('sha256').update(raw).digest();
}

/**
 * Encrypts a plaintext string. Returns a base64 string containing IV + auth tag + ciphertext.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: iv (12) + authTag (16) + ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

/**
 * Decrypts a string produced by encrypt(). Returns the original plaintext.
 */
export function decrypt(encoded: string): string {
  const key = getKey();
  const combined = Buffer.from(encoded, 'base64');
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Checks if a string looks like it was encrypted by us (base64-encoded, minimum length).
 */
export function isEncrypted(value: string): boolean {
  if (!value || value.length < 40) return false;
  try {
    const buf = Buffer.from(value, 'base64');
    return buf.length >= IV_LENGTH + AUTH_TAG_LENGTH + 1;
  } catch {
    return false;
  }
}
