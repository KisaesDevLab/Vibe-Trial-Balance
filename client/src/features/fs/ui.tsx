// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

// Small presentational pieces shared by the Statement Writer screens.

import type { ButtonHTMLAttributes, ReactNode } from 'react';

export const inputCls =
  'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60';

export const linkCls = 'text-xs text-blue-700 dark:text-blue-400 hover:underline disabled:opacity-50 disabled:no-underline';

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}</span>
      <div className="mt-0.5">{children}</div>
      {hint && <span className="text-[11px] text-gray-400 dark:text-gray-500">{hint}</span>}
    </label>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</h3>
      {children}
    </section>
  );
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 border border-transparent',
  secondary: 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700',
  danger: 'bg-red-600 text-white hover:bg-red-700 border border-transparent',
  ghost: 'border border-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
};

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  small?: boolean;
  /** Disables the button and shows a working label, so a slow save cannot be submitted twice. */
  busy?: boolean;
}

export function Btn({ variant = 'primary', small, busy, disabled, className = '', children, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || busy}
      className={`inline-flex items-center justify-center gap-1 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed ${small ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'} ${VARIANT[variant]} ${className}`}
    >
      {busy ? 'Working…' : children}
    </button>
  );
}

export function Badge({ tone, children, title }: { tone: 'green' | 'gray' | 'amber' | 'blue' | 'red'; children: ReactNode; title?: string }) {
  const cls = {
    green: 'bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    gray: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    red: 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  }[tone];
  return <span title={title} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 p-4 text-sm text-red-700 dark:text-red-300">{children}</div>;
}

/** Modal shell: backdrop, centered card, title, body, footer. */
export function Modal({ title, children, footer, wide }: { title: string; children: ReactNode; footer: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} rounded-xl bg-white dark:bg-gray-800 shadow-xl max-h-[90vh] overflow-y-auto`}>
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
        </div>
        <div className="px-6 py-4 space-y-4 text-sm text-gray-700 dark:text-gray-200">{children}</div>
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}
