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
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar admin={admin} activeTab={tab} onTabChange={setTab} onLogout={handleLogout} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
          <h1 className="text-lg font-semibold text-gray-800">{PAGE_TITLES[tab]}</h1>
          <div className="text-sm text-gray-500">
            {admin.fullName || admin.username} · <span className="text-indigo-600 font-medium">{admin.role}</span>
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
