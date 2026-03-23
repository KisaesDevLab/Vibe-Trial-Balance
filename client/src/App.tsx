import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { AppShell } from './components/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { ClientsPage } from './pages/ClientsPage';
import { ChartOfAccountsPage } from './pages/ChartOfAccountsPage';
import { PeriodsPage } from './pages/PeriodsPage';
import { TrialBalancePage } from './pages/TrialBalancePage';
import { JournalEntriesPage } from './pages/JournalEntriesPage';
import { BankTransactionsPage } from './pages/BankTransactionsPage';
import { SettingsPage } from './pages/SettingsPage';
import { FinancialStatementsPage } from './pages/FinancialStatementsPage';
import { TrialBalanceReportPage } from './pages/TrialBalanceReportPage';
import { GeneralLedgerPage } from './pages/GeneralLedgerPage';
import { TaxCodeReportPage } from './pages/TaxCodeReportPage';
import { WorkpaperIndexPage } from './pages/WorkpaperIndexPage';
import { AJEListingPage } from './pages/AJEListingPage';
import { UsersPage } from './pages/UsersPage';
import { DiagnosticsPage } from './pages/DiagnosticsPage';
import { ReconciliationsPage } from './pages/ReconciliationsPage';
import { TaxWorksheetsPage } from './pages/TaxWorksheetsPage';
import { EngagementPage } from './pages/EngagementPage';
import { CashFlowPage } from './pages/CashFlowPage';
import { CustomReportPage } from './pages/CustomReportPage';
import { WorkpaperPackagePage } from './pages/WorkpaperPackagePage';
import { TickmarksPage } from './pages/TickmarksPage';
import { TaxCodesPage } from './pages/TaxCodesPage';
import { TaxMappingPage } from './pages/TaxMappingPage';
import { TaxBasisPlPage } from './pages/TaxBasisPlPage';
import { TaxReturnOrderPage } from './pages/TaxReturnOrderPage';
import { MultiPeriodPage } from './pages/MultiPeriodPage';
import { ExportsPage } from './pages/ExportsPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { BackupPage } from './pages/BackupPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { AiUsageLogPage } from './pages/AiUsageLogPage';
import { SupportPage } from './pages/SupportPage';
import { CoaTemplatesPage } from './pages/CoaTemplatesPage';
import { SystemTickmarksPage } from './pages/SystemTickmarksPage';
import { TransactionEntryPage } from './pages/TransactionEntryPage';
import { UnitsPage } from './pages/UnitsPage';
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
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="chart-of-accounts" element={<ChartOfAccountsPage />} />
          <Route path="periods" element={<PeriodsPage />} />
          <Route path="trial-balance" element={<TrialBalancePage />} />
          <Route path="journal-entries" element={<JournalEntriesPage />} />
          <Route path="bank-transactions" element={<BankTransactionsPage />} />
          <Route path="financial-statements" element={<FinancialStatementsPage />} />
          <Route path="trial-balance-report" element={<TrialBalanceReportPage />} />
          <Route path="general-ledger" element={<GeneralLedgerPage />} />
          <Route path="tax-code-report" element={<TaxCodeReportPage />} />
          <Route path="workpaper-index" element={<WorkpaperIndexPage />} />
          <Route path="aje-listing" element={<AJEListingPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="diagnostics" element={<DiagnosticsPage />} />
          <Route path="reconciliations" element={<ReconciliationsPage />} />
          <Route path="tax-worksheets" element={<TaxWorksheetsPage />} />
          <Route path="engagement" element={<EngagementPage />} />
          <Route path="cash-flow" element={<CashFlowPage />} />
          <Route path="custom-reports" element={<CustomReportPage />} />
          <Route path="workpaper-package" element={<WorkpaperPackagePage />} />
          <Route path="tickmarks" element={<TickmarksPage />} />
          <Route path="tax-mapping" element={<TaxMappingPage />} />
          <Route path="tax-basis-pl" element={<TaxBasisPlPage />} />
          <Route path="tax-return-order" element={<TaxReturnOrderPage />} />
          <Route path="tax-codes" element={<TaxCodesPage />} />
          <Route path="multi-period" element={<MultiPeriodPage />} />
          <Route path="exports" element={<ExportsPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="backup" element={<BackupPage />} />
          <Route path="audit-log" element={<AuditLogPage />} />
          <Route path="ai-usage-log" element={<AiUsageLogPage />} />
          <Route path="support" element={<SupportPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="coa-templates" element={<CoaTemplatesPage />} />
          <Route path="system-tickmarks" element={<SystemTickmarksPage />} />
          <Route path="transaction-entry" element={<TransactionEntryPage />} />
          <Route path="units" element={<UnitsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
