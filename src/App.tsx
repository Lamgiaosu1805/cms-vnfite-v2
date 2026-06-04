import { useState } from 'react';
import { clearSession, getStoredAdmin, type AdminInfo } from './api/client';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { LoansPage } from './pages/LoansPage';
import { Sidebar, type TabKey } from './components/Sidebar';

const PAGE_TITLES: Record<TabKey, string> = {
  dashboard: 'Dashboard',
  users: 'Khách hàng',
  loans: 'Khoản vay',
};

export default function App() {
  const [admin, setAdmin] = useState<AdminInfo | null>(getStoredAdmin);
  const [tab, setTab] = useState<TabKey>('dashboard');

  if (!admin) {
    return <LoginPage onLoggedIn={setAdmin} />;
  }

  function handleLogout() {
    clearSession();
    setAdmin(null);
  }

  return (
    <div className="flex min-h-screen bg-[#FFF8F7]">
      <Sidebar admin={admin} activeTab={tab} onTabChange={setTab} onLogout={handleLogout} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            {/* Red accent bar */}
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

        {/* Content */}
        <main className="flex-1 p-6 overflow-auto">
          {tab === 'dashboard' && <DashboardPage />}
          {tab === 'users' && <UsersPage />}
          {tab === 'loans' && <LoansPage />}
        </main>
      </div>
    </div>
  );
}
