import { useEffect, useState } from 'react';
import { checkSetupRequired, clearSession, consumeSessionNotice, fetchLoans, fetchManualDeposits, getStoredAdmin, type AdminInfo, type LoginResult } from './api/client';
import { LoginPage } from './pages/LoginPage';
import { SetupPage } from './pages/SetupPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { TotpSetupPage } from './pages/TotpSetupPage';
import { TotpVerifyPage } from './pages/TotpVerifyPage';
import { DashboardPage } from './pages/DashboardPage';
import { CustomerDetailPage, UsersPage } from './pages/UsersPage';
import { LoansPage } from './pages/LoansPage';
import { LoanProductsPage } from './pages/LoanProductsPage';
import { AdminsPage } from './pages/AdminsPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { ManualDepositsPage } from './pages/ManualDepositsPage';
import { OtpIpUnblockRequestsPage } from './pages/OtpIpUnblockRequestsPage';
import WithdrawalsMonitoringPage from './pages/WithdrawalsMonitoringPage';
import ReconciliationPage from './pages/ReconciliationPage';
import AutoDebitAuditPage from './pages/AutoDebitAuditPage';
import DistributionLogPage from './pages/DistributionLogPage';
import FeeRevenuePage from './pages/FeeRevenuePage';
import RepaymentDueTodayPage from './pages/RepaymentDueTodayPage';
import { EarlySettlementsPage } from './pages/EarlySettlementsPage';
import { BusinessProfilesPage } from './pages/BusinessProfilesPage';
import { NewsManagementPage } from './pages/NewsManagementPage';
import { RecruitmentManagementPage } from './pages/RecruitmentManagementPage';
import { Sidebar, type TabKey } from './components/Sidebar';
import { Moon, RefreshCw, Sun } from 'lucide-react';
import { LOAN_STATUS_OPTIONS, loanStatusLabel, type LoanStatusFilter } from './loanConstants';

const PAGE_TITLES: Record<TabKey, string> = {
  dashboard: 'Dashboard',
  users: 'Khách hàng',
  'business-kyc': 'Hồ sơ doanh nghiệp',
  transactions: 'Giao dịch nạp/rút',
  'manual-deposits': 'Duyệt bill nạp tiền',
  'otp-unblock-requests': 'Mở chặn OTP',
  loans: 'Gọi vốn',
  'business-loans': 'Gọi vốn DN / Hộ KD',
  products: 'Sản phẩm gọi vốn',
  news: 'Tin tức',
  recruitment: 'Tuyển dụng',
  admins: 'Quản lý Admin',
  audit: 'Nhật ký quyết định',
  withdrawals: 'Giám sát rút tiền',
  reconciliation: 'Tra soát giao dịch',
  'due-today': 'Đến hạn hôm nay',
  'auto-debit-audit': 'Lịch sử thu nợ tự động',
  'distribution-log': 'Phân bổ & Thuế TNCN',
  'fee-revenue': 'Doanh thu phí',
  'early-settlements': 'Tất toán sớm',
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

type MainHistoryState = {
  cmsScreen: 'main';
  tab: TabKey;
  loanStatus: LoanStatusFilter;
  businessLoanStatus: LoanStatusFilter;
  selectedCustomerId: string | null;
  selectedLoanId: string | null;
  /** User đang mở sẵn ở tab Hồ sơ doanh nghiệp — điều hướng chéo từ khoản gọi vốn DN/HKD. */
  selectedBusinessProfileUserId: string | null;
};

function replaceCmsHistory(screen: CmsHistoryScreen) {
  window.history.replaceState({ cmsScreen: screen }, '', currentCmsUrl());
}

function pushCmsHistory(screen: CmsHistoryScreen) {
  window.history.pushState({ cmsScreen: screen }, '', currentCmsUrl());
}

function pushMainHistory(
  tab: TabKey,
  loanStatus: LoanStatusFilter,
  selectedCustomerId: string | null,
  selectedLoanId: string | null = null,
  businessLoanStatus: LoanStatusFilter = '',
  selectedBusinessProfileUserId: string | null = null,
) {
  window.history.pushState(
    { cmsScreen: 'main', tab, loanStatus, businessLoanStatus, selectedCustomerId, selectedLoanId, selectedBusinessProfileUserId } satisfies MainHistoryState,
    '',
    currentCmsUrl(),
  );
}

function replaceMainHistory(
  tab: TabKey,
  loanStatus: LoanStatusFilter,
  selectedCustomerId: string | null,
  selectedLoanId: string | null = null,
  businessLoanStatus: LoanStatusFilter = '',
  selectedBusinessProfileUserId: string | null = null,
) {
  window.history.replaceState(
    { cmsScreen: 'main', tab, loanStatus, businessLoanStatus, selectedCustomerId, selectedLoanId, selectedBusinessProfileUserId } satisfies MainHistoryState,
    '',
    currentCmsUrl(),
  );
}

export default function App() {
  const [state, setState] = useState<AppState>({ screen: 'loading' });
  const [tab, setTab] = useState<TabKey>('dashboard');
  const [loanStatus, setLoanStatus] = useState<LoanStatusFilter>('');
  const [businessLoanStatus, setBusinessLoanStatus] = useState<LoanStatusFilter>('');
  const [loanStatusCounts, setLoanStatusCounts] = useState<Record<string, number>>({});
  const [businessLoanStatusCounts, setBusinessLoanStatusCounts] = useState<Record<string, number>>({});
  const [loanCountsRefresh, setLoanCountsRefresh] = useState(0);
  const [manualDepositPendingCount, setManualDepositPendingCount] = useState(0);
  const [manualDepositCountRefresh, setManualDepositCountRefresh] = useState(0);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('cms_theme') === 'dark');
  const [loginNotice, setLoginNotice] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [selectedBusinessProfileUserId, setSelectedBusinessProfileUserId] = useState<string | null>(null);

  useEffect(() => {
    setLoginNotice(consumeSessionNotice());
    const storedAdmin = getStoredAdmin();
    if (storedAdmin) {
      replaceMainHistory('dashboard', '', null);
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
    if (state.screen !== 'main') return;
    let active = true;
    const load = () => {
      fetchManualDeposits('PENDING', 0, 1)
        .then(result => { if (active) setManualDepositPendingCount(result.totalElements); })
        .catch(() => { if (active) setManualDepositPendingCount(0); });
    };
    load();
    const timer = window.setInterval(load, 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [state.screen, manualDepositCountRefresh]);

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
          const s = event.state as MainHistoryState | undefined;
          setTab(s?.tab ?? 'dashboard');
          setLoanStatus(s?.loanStatus ?? '');
          setBusinessLoanStatus(s?.businessLoanStatus ?? '');
          setSelectedCustomerId(s?.selectedCustomerId ?? null);
          setSelectedLoanId(s?.selectedLoanId ?? null);
          setSelectedBusinessProfileUserId(s?.selectedBusinessProfileUserId ?? null);
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
        const result = await fetchLoans({
          status: item.value || undefined,
          productCategories: ['INDIVIDUAL'],
          page: 0,
          size: 1,
        });
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

  useEffect(() => {
    if (state.screen !== 'main') return;
    let cancelled = false;
    Promise.all(
      LOAN_STATUS_OPTIONS.map(async item => {
        const result = await fetchLoans({
          status: item.value || undefined,
          productCategories: ['BUSINESS', 'ENTERPRISE'],
          page: 0,
          size: 1,
        });
        return [item.value, result.totalElements] as const;
      }),
    )
      .then(entries => {
        if (!cancelled) setBusinessLoanStatusCounts(Object.fromEntries(entries));
      })
      .catch(() => {
        if (!cancelled) setBusinessLoanStatusCounts({});
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
      replaceMainHistory('dashboard', '', null);
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
    const nextLoanStatus = nextTab === 'loans' ? loanStatus : ('' as LoanStatusFilter);
    const nextBusinessLoanStatus = nextTab === 'business-loans' ? businessLoanStatus : ('' as LoanStatusFilter);
    pushMainHistory(nextTab, nextLoanStatus, null, null, nextBusinessLoanStatus);
    if (nextTab === 'loans') setLoanStatus(nextLoanStatus);
    if (nextTab === 'business-loans') setBusinessLoanStatus(nextBusinessLoanStatus);
    setSelectedCustomerId(null);
    setSelectedLoanId(null);
    setSelectedBusinessProfileUserId(null);
    setTab(nextTab);
  }

  function handleLoanStatusChange(nextStatus: LoanStatusFilter) {
    pushMainHistory('loans', nextStatus, null, null, '');
    setLoanStatus(nextStatus);
    setSelectedCustomerId(null);
    setSelectedLoanId(null);
    setSelectedBusinessProfileUserId(null);
    setTab('loans');
  }

  function handleBusinessLoanStatusChange(nextStatus: LoanStatusFilter) {
    pushMainHistory('business-loans', '', null, null, nextStatus);
    setBusinessLoanStatus(nextStatus);
    setSelectedCustomerId(null);
    setSelectedLoanId(null);
    setSelectedBusinessProfileUserId(null);
    setTab('business-loans');
  }

  /** Mở chi tiết 1 khách hàng — đẩy vào lịch sử để Back quay lại đúng chỗ trước đó. */
  function handleViewCustomer(userId: string) {
    pushMainHistory('users', loanStatus, userId, null);
    setTab('users');
    setSelectedCustomerId(userId);
    setSelectedLoanId(null);
    setSelectedBusinessProfileUserId(null);
  }

  /** Mở hồ sơ doanh nghiệp — điều hướng chéo từ khoản gọi vốn DN/HKD hoặc trang khách hàng cá nhân. */
  function handleViewBusinessProfile(userId: string) {
    pushMainHistory('business-kyc', loanStatus, null, null, businessLoanStatus, userId);
    setTab('business-kyc');
    setSelectedCustomerId(null);
    setSelectedLoanId(null);
    setSelectedBusinessProfileUserId(userId);
  }

  /** Mở chi tiết 1 khoản gọi vốn — điều hướng chéo từ mọi màn, Back quay lại đúng chỗ. */
  function handleViewLoan(loanId: string) {
    pushMainHistory('loans', loanStatus, null, loanId);
    setTab('loans');
    setSelectedCustomerId(null);
    setSelectedLoanId(loanId);
    setSelectedBusinessProfileUserId(null);
  }

  function handleViewBusinessLoan(loanId: string) {
    pushMainHistory('business-loans', '', null, loanId, businessLoanStatus);
    setTab('business-loans');
    setSelectedBusinessProfileUserId(null);
    setSelectedCustomerId(null);
    setSelectedLoanId(loanId);
  }

  function handleBackFromCustomer() {
    window.history.back();
  }

  /** Đóng chi tiết khoản — dùng Back của lịch sử để về đúng nơi đã mở (list hoặc khách hàng). */
  function handleCloseLoan() {
    window.history.back();
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
    return <LoginPage onPasswordVerified={handlePasswordVerified} onLoggedIn={handleLoggedIn} notice={loginNotice} onNoticeDismiss={() => setLoginNotice('')} />;
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
          replaceMainHistory('dashboard', '', null);
          setState({ screen: 'main', admin: state.admin });
        }}
      />
    );
  }

  // Main app
  const { admin } = state;
  const pageTitle = tab === 'users' && selectedCustomerId
    ? 'Chi tiết khách hàng'
    : (tab === 'loans' || tab === 'business-loans') && selectedLoanId
      ? 'Chi tiết khoản gọi vốn'
    : tab === 'loans'
      ? `${PAGE_TITLES[tab]} · ${loanStatusLabel(loanStatus)}`
      : tab === 'business-loans'
        ? `${PAGE_TITLES[tab]} · ${loanStatusLabel(businessLoanStatus)}`
      : PAGE_TITLES[tab];

  return (
    <div className="flex h-screen overflow-hidden bg-[#FFF8F7] dark:bg-gray-950">
      <Sidebar
        admin={admin}
        activeTab={tab}
        activeLoanStatus={loanStatus}
        activeBusinessLoanStatus={businessLoanStatus}
        loanStatusCounts={loanStatusCounts}
        businessLoanStatusCounts={businessLoanStatusCounts}
        manualDepositPendingCount={manualDepositPendingCount}
        onTabChange={handleTabChange}
        onLoanStatusChange={handleLoanStatusChange}
        onBusinessLoanStatusChange={handleBusinessLoanStatusChange}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
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
              ? <CustomerDetailPage
                  key={selectedCustomerId}
                  userId={selectedCustomerId}
                  onBack={handleBackFromCustomer}
                  onViewCustomer={handleViewCustomer}
                  onViewLoan={handleViewLoan}
                  onViewBusinessProfile={handleViewBusinessProfile}
                />
              : <UsersPage onViewCustomer={(user) => handleViewCustomer(user.userId)} />
          )}
          {tab === 'business-kyc' && (
            <BusinessProfilesPage
              initialUserId={selectedBusinessProfileUserId}
              onViewLoan={handleViewBusinessLoan}
            />
          )}
          {tab === 'transactions' && <TransactionsPage />}
          {tab === 'manual-deposits' && <ManualDepositsPage onActionDone={() => setManualDepositCountRefresh(value => value + 1)} />}
          {tab === 'otp-unblock-requests' && <OtpIpUnblockRequestsPage />}
          {tab === 'loans'     && (
            <LoansPage
              key={loanStatus || 'all'}
              status={loanStatus}
              selectedLoanId={selectedLoanId}
              productCategories={['INDIVIDUAL']}
              onViewLoan={handleViewLoan}
              onCloseLoan={handleCloseLoan}
              onViewCustomer={handleViewCustomer}
              onViewBusinessProfile={handleViewBusinessProfile}
              onActionDone={() => setLoanCountsRefresh(v => v + 1)}
            />
          )}
          {tab === 'business-loans' && (
            <LoansPage
              key="business-loans"
              status={businessLoanStatus}
              selectedLoanId={selectedLoanId}
              productCategories={['BUSINESS', 'ENTERPRISE']}
              title="Gọi vốn DN / Hộ KD"
              onViewLoan={handleViewBusinessLoan}
              onCloseLoan={handleCloseLoan}
              onViewCustomer={handleViewCustomer}
              onViewBusinessProfile={handleViewBusinessProfile}
              onActionDone={() => setLoanCountsRefresh(v => v + 1)}
            />
          )}
          {tab === 'products'    && <LoanProductsPage />}
          {tab === 'news'        && <NewsManagementPage />}
          {tab === 'recruitment' && <RecruitmentManagementPage />}
          {tab === 'admins'      && <AdminsPage />}
          {tab === 'audit'       && <AuditLogPage />}
          {tab === 'withdrawals'    && <WithdrawalsMonitoringPage />}
          {tab === 'reconciliation' && <ReconciliationPage />}
          {tab === 'due-today'         && <RepaymentDueTodayPage />}
          {tab === 'auto-debit-audit' && <AutoDebitAuditPage />}
          {tab === 'distribution-log' && <DistributionLogPage />}
          {tab === 'fee-revenue'      && <FeeRevenuePage />}
          {tab === 'early-settlements' && <EarlySettlementsPage />}
        </main>
      </div>
    </div>
  );
}
