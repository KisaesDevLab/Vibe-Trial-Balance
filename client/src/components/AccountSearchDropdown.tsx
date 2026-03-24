import { useState, useRef, useEffect } from 'react';
import type { Account } from '../api/chartOfAccounts';

interface AccountSearchDropdownProps {
  accounts: Account[];
  value: number | '';
  onChange: (accountId: number | '') => void;
  placeholder?: string;
  className?: string;
  /** Start the dropdown open immediately (e.g. when entering edit mode) */
  defaultOpen?: boolean;
  /** Called when the dropdown closes without a selection (e.g. click outside) */
  onClose?: () => void;
  /** Extra keydown handler on the trigger button (e.g. Tab navigation in grids).
   *  Called for keys that are NOT handled internally (Alt+Down, printable chars). */
  onKeyDown?: React.KeyboardEventHandler<HTMLButtonElement>;
  /** data-pr attribute on trigger button for pending-row navigation */
  triggerRow?: number;
  /** data-pc attribute on trigger button for pending-row navigation */
  triggerCol?: number;
}

export function AccountSearchDropdown({
  accounts,
  value,
  onChange,
  placeholder = 'Select account…',
  className = '',
  defaultOpen = false,
  onClose,
  onKeyDown,
  triggerRow,
  triggerCol,
}: AccountSearchDropdownProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const current = value !== '' ? accounts.find((a) => a.id === value) : null;

  const filtered = accounts.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.account_number.toLowerCase().includes(q) ||
      a.account_name.toLowerCase().includes(q)
    );
  });

  // Focus the search input whenever the dropdown opens
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      if (searchRef.current) {
        searchRef.current.focus();
        const len = searchRef.current.value.length;
        searchRef.current.setSelectionRange(len, len);
      }
    }, 0);
    return () => clearTimeout(id);
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
        onClose?.();
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open, onClose]);

  function openWith(initialSearch = '') {
    setSearch(initialSearch);
    setOpen(true);
  }

  function closeDropdown(notify = false) {
    setOpen(false);
    setSearch('');
    if (notify) onClose?.();
  }

  const select = (accountId: number | '') => {
    onChange(accountId);
    closeDropdown();
  };

  // onFocus: open the dropdown whenever the trigger button receives focus
  // (covers both Tab-navigation and click).
  function handleTriggerFocus() {
    if (!open) openWith('');
  }

  // onMouseDown: if the dropdown is already open and the user clicks the trigger
  // button, close it and prevent the subsequent focus event from re-opening it.
  function handleTriggerMouseDown(e: React.MouseEvent<HTMLButtonElement>) {
    if (open) {
      e.preventDefault(); // stops focus from firing after mousedown
      setOpen(false);
      setSearch('');
    }
  }

  // Keys on the trigger button (dropdown is closed when this fires,
  // because focus opens it immediately — so these handle edge cases)
  function handleTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    // Alt+Down — open (in case focus didn't already open it)
    if (e.altKey && e.key === 'ArrowDown') {
      e.preventDefault();
      openWith('');
      return;
    }

    // Escape while open — close
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      closeDropdown(true);
      return;
    }

    // Anything else (Tab, grid arrow keys, etc.) → pass to caller
    onKeyDown?.(e);
  }

  // Keys inside the search input
  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeDropdown(true);
      triggerRef.current?.focus();
      return;
    }
    if (e.key === 'Tab') {
      // Close and let Tab move to the next focusable element naturally
      closeDropdown();
      return;
    }
    if (e.key === 'Enter' && filtered.length > 0) {
      e.preventDefault();
      select(filtered[0].id);
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onFocus={handleTriggerFocus}
        onMouseDown={handleTriggerMouseDown}
        onKeyDown={handleTriggerKeyDown}
        data-pr={triggerRow}
        data-pc={triggerCol}
        className={`w-full text-left px-2 py-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:border-blue-400 truncate dark:text-white ${
          current ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 italic'
        }`}
      >
        {current
          ? `${current.account_number} – ${current.account_name}`
          : placeholder}
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <div className="p-2 border-b">
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search by number or name…"
              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {value !== '' && (
              <button
                type="button"
                onClick={() => select('')}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-400 dark:text-gray-500 italic hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b dark:border-gray-700"
              >
                — clear —
              </button>
            )}
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">No matching accounts</p>
            ) : (
              filtered.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => select(a.id)}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 dark:hover:bg-blue-900/30 ${value === a.id ? 'bg-blue-50 dark:bg-blue-900/30 font-medium' : ''}`}
                >
                  <span className="font-mono font-medium text-gray-900 dark:text-white">{a.account_number}</span>
                  <span className="text-gray-600 dark:text-gray-400 ml-1">– {a.account_name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
