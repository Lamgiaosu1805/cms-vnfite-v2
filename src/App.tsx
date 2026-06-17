import { useEffect, useState } from 'react';
import { checkSetupRequired, clearSession, consumeSessionNotice, fetchLoans, getStoredAdmin, type AdminInfo, type LoginResult } from './api/client';
import { LoginPage } from './pages/LoginPage';
import { SetupPage } from './pages/SetupPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { TotpSetupPage } from './pages/TotpSetupPage';
import { TotpVerifyPage } from './pages/TotpVerifyPage';
import { DashboardPage } from './pages/DashboardPage';
import { CustomerDetailPage, UsersPage } from './pages/UsersPage';
import { LoansPage } from './pages/LoansPage';
import { AdminsPage } from './pages/AdminsPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { Sidebar, type TabKey } from './components/Sidebar';
import { Moon, RefreshCw, Sun } from 'lucide-react';
import { LOAN_STATUS_OPTIONS, loanStatusLabel, type LoanStatusFilter } from './loanConstants';

const PAGE_TITLES: Record<TabKey, string> = {
  dashboard: 'Dashboard',
  users: 'Khách hàng',
  loans: 'Gọi vốn',
  admins: 'Quản lý Admin',
  audit: 'Nhật ký quyết định',
};

type AppState =
  | { screen: 'loading' }
  | { screen: 'setup' }
  | { screen: 'login' }
  | { screen: 'totp-setup'; pendingToken: string }
  | { screen: 'totp-verify'; pendingToken: string }
  | { screen: 'change-password'; admin: AdminInfo }
  | { screen: 'main'; admin: AdminInfo };

type CmsHistoryScreen = Extract<AppState['screen'], 'setup' | 'login' | 'totp-setup' | 'totp-verify' | 'change-password' | 'main'>;

function currentCmsUrl() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function replaceCmsHistory(screen: CmsHistoryScreen) {
  window.history.replaceState({ cmsScreen: screen }, '', currentCmsUrl());
}

function pushCmsHistory(screen: CmsHistoryScreen) {
  window.history.pushState({ cmsScreen: screen }, '', currentCmsUrl());
}

export default function App() {
  const [state, setState] = useState<AppState>({ screen: 'loading' });
  const [tab, setTab] = useState<TabKey>('dashboard');
  const [loanStatus, setLoanStatus] = useState<LoanStatusFilter>('');
  const [loanStatusCounts, setLoanStatusCounts] = useState<Record<string, number>>({});
  const [loanCountsRefresh, setLoanCountsRefresh] = useState(0);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('cms_theme') === 'dark');
  const [loginNotice, setLoginNotice] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  useEffect(() => {
    setLoginNotice(consumeSessionNotice());
    const storedAdmin = getStoredAdmin();
    if (storedAdmin) {
      replaceCmsHistory('main');
      setState({ screen: 'main', admin: storedAdmin });
      return;
    }
    checkSetupRequired()
      .then(required => {
        const screen = required ? 'setup' : 'login';
        replaceCmsHistory(screen);
        setState({ screen });
      })
      .catch(() => {
        replaceCmsHistory('login');
        setState({ screen: 'login' });
      });
  }, []);

  useEffect(() => {
    function handleBrowserBack(event: PopStateEvent) {
      const screen = event.state?.cmsScreen as CmsHistoryScreen | undefined;
      if (!screen) return;

      if (screen === 'login' || screen === 'setup') {
        // Nếu user vẫn còn session hợp lệ (ấn Back từ main → login)
        // → không xóa session, đưa về main
        const storedAdmin = getStoredAdmin();
        if (storedAdmin) {
          replaceCmsHistory('main');
          setState({ screen: 'main', admin: storedAdmin });
          return;
        }
        // Không có session (ví dụ đang ở giữa luồng TOTP mà ấn Back)
        // → xóa pending state và về login
        clearSession();
        setState({ screen: 'login' });
        return;
      }

      if (screen === 'main') {
        const storedAdmin = getStoredAdmin();
        if (storedAdmin) {
          setState({ screen: 'main', admin: storedAdmin });
        } else {
          replaceCmsHistory('login');
          setState({ screen: 'login' });
        }
      }
    }

    window.addEventListener('popstate', handleBrowserBack);
    return () => window.removeEventListener('popstate', handleBrowserBack);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('cms_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    if (state.screen !== 'main') return;
    let cancelled = false;
    Promise.all(
      LOAN_STATUS_OPTIONS.map(async item => {
        const result = await fetchLoans({ status: item.value || undefined, page: 0, size: 1 });
        return [item.value, result.totalElements] as const;
      }),
    )
      .then(entries => {
        if (!cancelled) setLoanStatusCounts(Object.fromEntries(entries));
      })
      .catch(() => {
        if (!cancelled) setLoanStatusCounts({});
      });
    return () => { cancelled = true; };
  }, [state.screen, loanCountsRefresh]);

  /** Gọi sau bước xác thực mật khẩu — chuyển sang TOTP */
  function handlePasswordVerified(pendingToken: string, totpEnabled: boolean) {
    const screen = totpEnabled ? 'totp-verify' : 'totp-setup';
    pushCmsHistory(screen);
    setState(totpEnabled
      ? { screen: 'totp-verify', pendingToken }
      : { screen: 'totp-setup', pendingToken }
    );
  }

  /** Gọi sau khi TOTP xong và có accessToken đầy đủ */
  function handleLoggedIn({ admin, mustChangePassword }: LoginResult) {
    if (mustChangePassword) {
      replaceCmsHistory('change-password');
      setState({ screen: 'change-password', admin });
    } else {
      replaceCmsHistory('main');
      setState({ screen: 'main', admin });
    }
  }

  function handleLogout() {
    clearSession();
    replaceCmsHistory('login');
    setState({ screen: 'login' });
  }

  function backToLogin() {
    clearSession();
    replaceCmsHistory('login');
    setState({ screen: 'login' });
  }

  function handleTabChange(nextTab: TabKey) {
    if (nextTab === 'loans') setLoanStatus('');
    setSelectedCustomerId(null);
    setTab(nextTab);
  }

  function handleLoanStatusChange(nextStatus: LoanStatusFilter) {
    setLoanStatus(nextStatus);
    setSelectedCustomerId(null);
    setTab('loans');
  }

  // ─── Screens ─────────────────────────────────────────────────────────────────

  if (state.screen === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFF8F7]">
        <RefreshCw size={24} className="animate-spin" style={{ color: '#C82020' }} />
      </div>
    );
  }

  if (state.screen === 'setup') {
    return <SetupPage onDone={() => {
      replaceCmsHistory('login');
      setState({ screen: 'login' });
    }} />;
  }

  if (state.screen === 'login') {
    return <LoginPage onPasswordVerified={handlePasswordVerified} notice={loginNotice} onNoticeDismiss={() => setLoginNotice('')} />;
  }

  if (state.screen === 'totp-setup') {
    return (
      <TotpSetupPage
        pendingToken={state.pendingToken}
        onLoggedIn={handleLoggedIn}
        onBack={backToLogin}
      />
    );
  }

  if (state.screen === 'totp-verify') {
    return (
      <TotpVerifyPage
        pendingToken={state.pendingToken}
        onLoggedIn={handleLoggedIn}
        onBack={backToLogin}
      />
    );
  }

  if (state.screen === 'change-password') {
    return (
      <ChangePasswordPage
        admin={state.admin}
        onDone={() => {
          replaceCmsHistory('main');
          setState({ screen: 'main', admin: state.admin });
        }}
      />
    );
  }

  // Main app
  const { admin } = state;
  const pageTitle = tab === 'users' && selectedCustomerId
    ? 'Chi tiết khách hàng'
    : tab === 'loans'
      ? `${PAGE_TITLES[tab]} · ${loanStatusLabel(loanStatus)}`
      : PAGE_TITLES[tab];

  return (
    <div className="flex min-h-screen bg-[#FFF8F7] dark:bg-gray-950">
      <Sidebar
        admin={admin}
        activeTab={tab}
        activeLoanStatus={loanStatus}
        loanStatusCounts={loanStatusCounts}
        onTabChange={handleTabChange}
        onLoanStatusChange={handleLoanStatusChange}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 px-6 py-4 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 rounded-full" style={{ background: 'linear-gradient(180deg, #C82020, #8B0A0A)' }} />
            <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">
              {pageTitle}
            </h1>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <button
              type="button"
              onClick={() => setDarkMode(value => !value)}
              title={darkMode ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 transition hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200"
            >
              {darkMode ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ background: 'linear-gradient(135deg, #C82020, #8B0A0A)' }}>
              {(admin.fullName || admin.username).charAt(0).toUpperCase()}
            </div>
            <span>{admin.fullName || admin.username}</span>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto dark:bg-gray-950">
          {tab === 'dashboard' && <DashboardPage />}
          {tab === 'users'     && (
            selectedCustomerId
              ? <CustomerDetailPage userId={selectedCustomerId} onBack={() => setSelectedCustomerId(null)} />
              : <UsersPage onViewCustomer={(user) => setSelectedCustomerId(user.userId)} />
          )}
          {tab === 'loans'     && (
            <LoansPage
              key={loanStatus || 'all'}
              status={loanStatus}
              onActionDone={() => setLoanCountsRefresh(v => v + 1)}
            />
          )}
          {tab === 'admins'    && <AdminsPage />}
          {tab === 'audit'     && <AuditLogPage />}
        </main>
      </div>
    </div>
  );
}
