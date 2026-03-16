import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { AppShell } from './components/AppShell';
import { ClientsPage } from './pages/ClientsPage';
import { ChartOfAccountsPage } from './pages/ChartOfAccountsPage';
import { PeriodsPage } from './pages/PeriodsPage';
import { TrialBalancePage } from './pages/TrialBalancePage';
import { JournalEntriesPage } from './pages/JournalEntriesPage';
import { BankTransactionsPage } from './pages/BankTransactionsPage';
import { SettingsPage } from './pages/SettingsPage';
import { useAuthStore } from './store/uiStore';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/clients" replace />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="chart-of-accounts" element={<ChartOfAccountsPage />} />
          <Route path="periods" element={<PeriodsPage />} />
          <Route path="trial-balance" element={<TrialBalancePage />} />
          <Route path="journal-entries" element={<JournalEntriesPage />} />
          <Route path="bank-transactions" element={<BankTransactionsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
