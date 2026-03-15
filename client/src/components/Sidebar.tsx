import { NavLink } from 'react-router-dom';
import { ClientSelector } from './ClientSelector';
import { useAuthStore } from '../store/uiStore';

const NAV_ITEMS = [
  { to: '/chart-of-accounts', label: 'Chart of Accounts' },
];

export function Sidebar() {
  const { user, clearAuth } = useAuthStore();

  return (
    <aside className="w-60 bg-gray-900 text-white flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-gray-700">
        <h1 className="text-base font-semibold tracking-tight">Trial Balance</h1>
      </div>

      {/* Client selector */}
      <div className="px-4 py-3 border-b border-gray-700">
        <ClientSelector />
      </div>

      {/* Nav */}
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

      {/* User footer */}
      <div className="px-4 py-3 border-t border-gray-700">
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
