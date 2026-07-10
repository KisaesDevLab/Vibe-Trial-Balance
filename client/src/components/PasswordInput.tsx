// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { forwardRef, useState, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  /** Optional override for the wrapper class. Inner input keeps its own classes. */
  wrapperClassName?: string;
};

const EYE_OFF = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" y1="2" x2="22" y2="22" />
  </svg>
);

const EYE = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

/**
 * Password input with an inline show/hide toggle. Forwards every native input
 * prop. The toggle button is `type="button"` so clicking it never submits a
 * surrounding form, and exposes aria-pressed + a switching label so screen
 * readers announce the visibility state.
 */
export const PasswordInput = forwardRef<HTMLInputElement, Props>(function PasswordInput(
  { wrapperClassName, className, ...rest },
  ref,
) {
  const [visible, setVisible] = useState(false);

  // Default Tailwind classes mirror the existing auth/admin form inputs so
  // the field looks identical to the surrounding form when callers pass no
  // className. Right padding leaves room for the eye button.
  const inputClass =
    className ??
    'w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white dark:placeholder-gray-400';

  return (
    <div className={wrapperClassName ?? 'relative'}>
      <input
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={inputClass}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        tabIndex={0}
        className="absolute inset-y-0 right-0 flex items-center px-2.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:text-gray-700 dark:focus:text-gray-200"
      >
        {visible ? EYE_OFF : EYE}
      </button>
    </div>
  );
});
