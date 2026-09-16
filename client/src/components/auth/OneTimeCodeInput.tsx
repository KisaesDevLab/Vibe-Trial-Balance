// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * The six-digit authenticator code field. One input, not six boxes: pasting
 * works, iOS/Android autofill from the authenticator works
 * (autoComplete="one-time-code"), and screen readers get one field.
 * Fires onComplete once per distinct six-digit value.
 */

import { useEffect, useId, useRef } from 'react';
import { TOTP_CODE_LENGTH, isCompleteTotpCode, normalizeTotpCode } from '../../utils/totpCode';

interface Props {
  value: string;
  onChange: (code: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  error?: string | null;
  autoFocus?: boolean;
  label?: string;
}

export function OneTimeCodeInput({ value, onChange, onComplete, disabled, error, autoFocus, label = 'Verification code' }: Props) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const lastCompleted = useRef<string | null>(null);

  useEffect(() => {
    if (isCompleteTotpCode(value) && lastCompleted.current !== value) {
      lastCompleted.current = value;
      onComplete?.(value);
    }
    if (!value) lastCompleted.current = null;
  }, [value, onComplete]);

  // A rejected code is cleared by the parent; put the cursor back.
  useEffect(() => {
    if (error) ref.current?.focus();
  }, [error]);

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      <input
        ref={ref}
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        maxLength={TOTP_CODE_LENGTH}
        value={value}
        onChange={(e) => onChange(normalizeTotpCode(e.target.value))}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        placeholder="123456"
        className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 font-mono text-2xl tracking-[0.4em] text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-50"
      />
      {error && <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
