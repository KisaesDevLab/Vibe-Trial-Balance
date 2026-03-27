import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ClientSelector } from './ClientSelector';
import { PeriodSelector } from './PeriodSelector';
import { useAuthStore, useUIStore } from '../store/uiStore';

interface NavItem {
  to: string;
  label: string;
}

interface NavGroup {
  title: string | null;
  items: NavItem[];
  defaultOpen?: boolean;
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: null,
    items: [
      { to: '/dashboard',  label: 'Dashboard' },
      { to: '/engagement', label: 'Engagement' },
    ],
    defaultOpen: true,
  },
  {
    title: 'Setup',
    items: [
      { to: '/clients',           label: 'Clients' },
      { to: '/chart-of-accounts', label: 'Chart of Accounts' },
      { to: '/units',             label: 'Units' },
      { to: '/periods',           label: 'Periods' },
    ],
    defaultOpen: false,
  },
  {
    title: 'Bookkeeping',
    items: [
      { to: '/bank-transactions',  label: 'Bank Transactions' },
      { to: '/transaction-entry', label: 'Transaction Entry' },
      { to: '/reconciliations',   label: 'Reconciliations' },
    ],
    defaultOpen: false,
  },
  {
    title: 'Trial Balance',
    items: [
      { to: '/trial-balance',  label: 'Trial Balance' },
      { to: '/py-tieout',      label: 'PY Tie-Out' },
      { to: '/journal-entries', label: 'Journal Entries' },
      { to: '/aje-listing',    label: 'AJE Listing' },
      { to: '/tickmarks',      label: 'Tickmarks' },
    ],
    defaultOpen: false,
  },
  {
    title: 'Tax',
    items: [
      { to: '/tax-mapping',       label: 'Tax Mapping' },
      { to: '/tax-basis-pl',      label: 'Tax-Basis P&L' },
      { to: '/tax-return-order',  label: 'Tax Return Order' },
      { to: '/tax-worksheets',    label: 'Tax Worksheets' },
    ],
    defaultOpen: false,
  },
  {
    title: 'Reports',
    items: [
      { to: '/multi-period',         label: 'Period Comparison' },
      { to: '/financial-statements', label: 'Financial Statements' },
      { to: '/cash-flow',            label: 'Cash Flow' },
      { to: '/general-ledger',       label: 'General Ledger' },
      { to: '/trial-balance-report', label: 'TB Report' },
      { to: '/tax-code-report',      label: 'Tax Code Report' },
      { to: '/workpaper-index',      label: 'Workpaper Index' },
      { to: '/workpaper-package',    label: 'Workpaper Package' },
      { to: '/custom-reports',       label: 'Custom Reports' },
      { to: '/exports',              label: 'Exports' },
    ],
    defaultOpen: false,
  },
  {
    title: 'Tools',
    items: [
      { to: '/documents',   label: 'Documents' },
      { to: '/diagnostics', label: 'AI Diagnostics' },
      { to: '/support',     label: 'Support' },
      { to: '/settings',    label: 'Settings' },
    ],
    defaultOpen: false,
  },
];

const ADMIN_GROUP: NavGroup = {
  title: 'Admin',
  items: [
    { to: '/users',              label: 'Users' },
    { to: '/tax-codes',          label: 'Tax Codes' },
    { to: '/coa-templates',      label: 'COA Templates' },
    { to: '/system-tickmarks',   label: 'Default Tickmarks' },
    { to: '/backup',             label: 'Backup & Restore' },
    { to: '/audit-log',          label: 'Audit Log' },
    { to: '/ai-usage-log',       label: 'AI Usage Log' },
  ],
  defaultOpen: false,
};

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className={`w-3.5 h-3.5 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
    >
      <path
        fillRule="evenodd"
        d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L9.19 8 6.22 5.03a.75.75 0 0 1 0-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

const navItemClass = (isActive: boolean) =>
  `flex items-center px-3 py-1.5 rounded text-sm transition-colors ${
    isActive
      ? 'bg-gray-700/80 text-white font-medium border-l-2 border-blue-400 pl-[10px]'
      : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100 border-l-2 border-transparent pl-[10px]'
  }`;

function NavSection({ group, isAdmin }: { group: NavGroup; isAdmin?: boolean }) {
  const [open, setOpen] = useState(group.defaultOpen ?? true);

  // Admin group hidden for non-admins
  if (isAdmin === false) return null;

  return (
    <div className="mb-1">
      {group.title !== null && (
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between px-3 py-1.5 group"
        >
          <span className="text-xs font-bold uppercase tracking-widest text-gray-400 group-hover:text-gray-300 transition-colors">
            {group.title}
          </span>
          <span className="text-gray-400 group-hover:text-gray-300 transition-colors">
            <ChevronIcon open={open} />
          </span>
        </button>
      )}

      {open && (
        <div className="space-y-px">
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => navItemClass(isActive)}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const { user, clearAuth } = useAuthStore();
  const { selectedClientId, fontSize, increaseFontSize, decreaseFontSize, isDarkMode, toggleDarkMode } = useUIStore();
  const isAdmin = user?.role === 'admin';

  return (
    <aside className="w-56 bg-gray-900 text-white flex flex-col shrink-0">
      {/* App header */}
      <div className="px-4 py-3.5 border-b border-gray-700/80">
        <h1 className="text-sm font-semibold tracking-tight text-white">Vibe TB</h1>
        <p className="text-[10px] text-gray-500 mt-0.5 tracking-wide uppercase">Tax Prep Suite</p>
      </div>

      {/* Client / Period selectors */}
      <div className="px-3 py-3 border-b border-gray-700/80 space-y-2.5">
        <ClientSelector />
        {selectedClientId && <PeriodSelector />}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 px-2 py-2 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <NavSection key={group.title ?? '__top'} group={group} />
        ))}

        {isAdmin && (
          <>
            <div className="my-2 border-t border-gray-700/60" />
            <NavSection group={ADMIN_GROUP} isAdmin={isAdmin} />
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-700/80 space-y-2">
        {/* Font size + dark mode */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider mr-1">Text</span>
          <button
            onClick={decreaseFontSize}
            title="Decrease font size"
            className="text-xs text-gray-400 hover:text-white w-6 h-6 flex items-center justify-center rounded hover:bg-gray-700"
          >A-</button>
          <span className="text-xs text-gray-500 w-5 text-center">{fontSize}</span>
          <button
            onClick={increaseFontSize}
            title="Increase font size"
            className="text-xs text-gray-400 hover:text-white w-6 h-6 flex items-center justify-center rounded hover:bg-gray-700"
          >A+</button>
          <div className="flex-1" />
          <button
            onClick={toggleDarkMode}
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className="text-gray-400 hover:text-white w-6 h-6 flex items-center justify-center rounded hover:bg-gray-700"
          >
            {isDarkMode ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
              </svg>
            )}
          </button>
        </div>
        {/* User */}
        <div>
          <div className="text-xs text-gray-300 font-medium truncate">{user?.displayName}</div>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-[10px] text-gray-500 capitalize">{user?.role}</span>
            <button
              onClick={clearAuth}
              className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
        {/* AGPL-3.0 §13 source disclosure */}
        <div className="pt-1.5 border-t border-gray-700/40">
          <p className="text-[9px] text-gray-600 leading-tight">
            AGPL-3.0 &middot;{' '}
            <a
              href="https://github.com/KisaesDevLab/Vibe-Trial-Balance"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-300 underline underline-offset-2"
            >
              Source Code
            </a>
          </p>
        </div>
      </div>
    </aside>
  );
}
