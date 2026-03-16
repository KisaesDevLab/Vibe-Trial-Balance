import { NavLink } from 'react-router-dom';
import { ClientSelector } from './ClientSelector';
import { PeriodSelector } from './PeriodSelector';
import { useAuthStore, useUIStore } from '../store/uiStore';

const NAV_ITEMS = [
  { to: '/clients', label: 'Clients' },
  { to: '/chart-of-accounts', label: 'Chart of Accounts' },
  { to: '/periods', label: 'Periods' },
  { to: '/trial-balance', label: 'Trial Balance' },
  { to: '/journal-entries', label: 'Journal Entries' },
  { to: '/bank-transactions', label: 'Bank Transactions' },
  { to: '/financial-statements', label: 'Financial Statements' },
  { to: '/trial-balance-report', label: 'TB Report' },
  { to: '/general-ledger', label: 'General Ledger' },
  { to: '/tax-code-report', label: 'Tax Code Report' },
  { to: '/workpaper-index', label: 'Workpaper Index' },
  { to: '/aje-listing', label: 'AJE Listing' },
  { to: '/settings', label: 'Settings' },
];

export function Sidebar() {
  const { user, clearAuth } = useAuthStore();
  const { selectedClientId, fontSize, increaseFontSize, decreaseFontSize } = useUIStore();

  return (
    <aside className="w-60 bg-gray-900 text-white flex flex-col shrink-0">
      <div className="px-4 py-4 border-b border-gray-700">
        <h1 className="text-base font-semibold tracking-tight">Trial Balance</h1>
      </div>

      <div className="px-4 py-3 border-b border-gray-700 space-y-3">
        <ClientSelector />
        {selectedClientId && <PeriodSelector />}
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-gray-700">
        <div className="flex items-center gap-1.5 mb-3">
          <span className="text-xs text-gray-500">Text</span>
          <button
            onClick={decreaseFontSize}
            title="Decrease font size"
            className="text-xs text-gray-400 hover:text-white w-6 h-6 flex items-center justify-center rounded hover:bg-gray-700"
          >A-</button>
          <span className="text-xs text-gray-400 w-6 text-center">{fontSize}</span>
          <button
            onClick={increaseFontSize}
            title="Increase font size"
            className="text-xs text-gray-400 hover:text-white w-6 h-6 flex items-center justify-center rounded hover:bg-gray-700"
          >A+</button>
        </div>
        <div className="text-sm text-gray-300 font-medium truncate">{user?.displayName}</div>
        <div className="text-xs text-gray-500 mb-2 capitalize">{user?.role}</div>
        <button
          onClick={clearAuth}
          className="text-xs text-gray-400 hover:text-white transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
