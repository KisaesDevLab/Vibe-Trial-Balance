import React from 'react';

// ── helpers ──────────────────────────────────────────────────────────────────

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIso(s: string): { year: number; month: number; day: number } | null {
  const parts = s.split('-');
  if (parts.length !== 3) return null;
  const [y, mo, d] = parts.map(Number);
  if (isNaN(y) || isNaN(mo) || isNaN(d)) return null;
  return { year: y, month: mo, day: d };
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
//   +  or  =   next day
//   -          prev day
//   t / T      today
//   y / Y      first day of year
//   r / R      last day of year
//   m / M      first day of month
//   h / H      last day of month

const TITLE = '+ next day  − prev day  T today  Y first of year  R last of year  M first of month  H last of month';

// ── Component ─────────────────────────────────────────────────────────────────

type DateInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

export function DateInput({ value, onChange, onKeyDown, disabled, ...rest }: DateInputProps) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) {
      onKeyDown?.(e);
      return;
    }

    const raw = typeof value === 'string' ? value : '';
    const parsed = parseIso(raw) ?? parseIso(toIso(new Date()));
    if (!parsed) { onKeyDown?.(e); return; }

    const { year, month, day } = parsed;
    let newDate: string | null = null;

    switch (e.key) {
      case 't':
      case 'T':
        newDate = toIso(new Date());
        break;
      case '+':
      case '=':
        newDate = toIso(new Date(year, month - 1, day + 1));
        break;
      case '-':
        newDate = toIso(new Date(year, month - 1, day - 1));
        break;
      case 'y':
      case 'Y':
        // Snap to Jan 1 of current year; if already there, go to Jan 1 of previous year
        newDate = (month === 1 && day === 1)
          ? `${year - 1}-01-01`
          : `${year}-01-01`;
        break;
      case 'r':
      case 'R':
        // Snap to Dec 31 of current year; if already there, advance to Dec 31 of next year
        newDate = (month === 12 && day === 31)
          ? `${year + 1}-12-31`
          : `${year}-12-31`;
        break;
      case 'm':
      case 'M': {
        // Snap to 1st of current month; if already there, go to 1st of previous month
        const d = day === 1
          ? new Date(year, month - 2, 1)   // month-2 because JS months are 0-indexed
          : new Date(year, month - 1, 1);
        newDate = toIso(d);
        break;
      }
      case 'h':
      case 'H': {
        const lastDayThisMonth = new Date(year, month, 0).getDate();
        // Snap to last day of current month; if already there, advance to last day of next month
        const d = day === lastDayThisMonth
          ? new Date(year, month + 1, 0)   // day 0 of (month+1 in 0-indexed) = last day of next month
          : new Date(year, month - 1, lastDayThisMonth);
        newDate = toIso(d);
        break;
      }
    }

    if (newDate !== null) {
      e.preventDefault();
      onChange?.({ target: { value: newDate } } as React.ChangeEvent<HTMLInputElement>);
    } else {
      // Not a shortcut — pass through to caller (e.g. Tab/Enter navigation)
      onKeyDown?.(e);
    }
  }

  return (
    <input
      type="date"
      value={value}
      onChange={onChange}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      title={disabled ? undefined : TITLE}
      {...rest}
    />
  );
}
