import { useEffect, useState } from 'react';
import { checkSetupRequired, clearSession, getStoredAdmin, type AdminInfo, type LoginResult } from './api/client';
import { LoginPage } from './pages/LoginPage';
import { SetupPage } from './pages/SetupPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { TotpSetupPage } from './pages/TotpSetupPage';
import { TotpVerifyPage } from './pages/TotpVerifyPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { LoansPage } from './pages/LoansPage';
import { AdminsPage } from './pages/AdminsPage';
import { Sidebar, type TabKey } from './components/Sidebar';
import { RefreshCw } from 'lucide-react';

const PAGE_TITLES: Record<TabKey, string> = {
  dashboard: 'Dashboard',
  users: 'Khách hàng',
  loans: 'Khoản vay',
  admins: 'Quản lý Admin',
};

type AppState =
  | { screen: 'loading' }
  | { screen: 'setup' }
  | { screen: 'login' }
  | { screen: 'totp-setup'; pendingToken: string }
  | { screen: 'totp-verify'; pendingToken: string }
  | { screen: 'change-password'; admin: AdminInfo }
  | { screen: 'main'; admin: AdminInfo };

export default function App() {
  const [state, setState] = useState<AppState>({ screen: 'loading' });
  const [tab, setTab] = useState<TabKey>('dashboard');

  useEffect(() => {
    const storedAdmin = getStoredAdmin();
    if (storedAdmin) {
      setState({ screen: 'main', admin: storedAdmin });
      return;
    }
    checkSetupRequired()
      .then(required => setState({ screen: required ? 'setup' : 'login' }))
      .catch(() => setState({ screen: 'login' }));
  }, []);

  /** Gọi sau bước xác thực mật khẩu — chuyển sang TOTP */
  function handlePasswordVerified(pendingToken: string, totpEnabled: boolean) {
    setState(totpEnabled
      ? { screen: 'totp-verify', pendingToken }
      : { screen: 'totp-setup', pendingToken }
    );
  }

  /** Gọi sau khi TOTP xong và có accessToken đầy đủ */
  function handleLoggedIn({ admin, mustChangePassword }: LoginResult) {
    if (mustChangePassword) {
      setState({ screen: 'change-password', admin });
    } else {
      setState({ screen: 'main', admin });
    }
  }

  function handleLogout() {
    clearSession();
    setState({ screen: 'login' });
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
    return <SetupPage onDone={() => setState({ screen: 'login' })} />;
  }

  if (state.screen === 'login') {
    return <LoginPage onPasswordVerified={handlePasswordVerified} />;
  }

  if (state.screen === 'totp-setup') {
    return (
      <TotpSetupPage
        pendingToken={state.pendingToken}
        onLoggedIn={handleLoggedIn}
        onBack={() => setState({ screen: 'login' })}
      />
    );
  }

  if (state.screen === 'totp-verify') {
    return (
      <TotpVerifyPage
        pendingToken={state.pendingToken}
        onLoggedIn={handleLoggedIn}
        onBack={() => setState({ screen: 'login' })}
      />
    );
  }

  if (state.screen === 'change-password') {
    return (
      <ChangePasswordPage
        admin={state.admin}
        onDone={() => setState({ screen: 'main', admin: state.admin })}
      />
    );
  }

  // Main app
  const { admin } = state;
  return (
    <div className="flex min-h-screen bg-[#FFF8F7]">
      <Sidebar admin={admin} activeTab={tab} onTabChange={setTab} onLogout={handleLogout} />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 rounded-full" style={{ background: 'linear-gradient(180deg, #C82020, #8B0A0A)' }} />
            <h1 className="text-lg font-bold text-gray-800">{PAGE_TITLES[tab]}</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ background: 'linear-gradient(135deg, #C82020, #8B0A0A)' }}>
              {(admin.fullName || admin.username).charAt(0).toUpperCase()}
            </div>
            <span>{admin.fullName || admin.username}</span>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          {tab === 'dashboard' && <DashboardPage />}
          {tab === 'users' && <UsersPage />}
          {tab === 'loans' && <LoansPage />}
          {tab === 'admins' && <AdminsPage />}
        </main>
      </div>
    </div>
  );
}
