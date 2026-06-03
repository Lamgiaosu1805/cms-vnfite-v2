import { BarChart3, CircleDollarSign, LayoutDashboard, LogOut, ShieldCheck, Users } from 'lucide-react';
import type { AdminInfo } from '../api/client';

export type TabKey = 'dashboard' | 'users' | 'loans';

interface SidebarProps {
  admin: AdminInfo;
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  onLogout: () => void;
}

const navItems: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { key: 'users', label: 'Khách hàng', icon: <Users size={18} /> },
  { key: 'loans', label: 'Khoản vay', icon: <CircleDollarSign size={18} /> },
];

export function Sidebar({ admin, activeTab, onTabChange, onLogout }: SidebarProps) {
  return (
    <aside className="w-60 min-h-screen bg-slate-900 text-white flex flex-col shrink-0">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <ShieldCheck size={20} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-tight">P2P Lending CMS</p>
            <p className="text-xs text-slate-400 truncate">{admin.fullName || admin.username}</p>
          </div>
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <BarChart3 size={12} className="text-slate-400" />
          <span className="text-xs text-slate-400">{admin.role}</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => onTabChange(key)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-indigo-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-slate-700">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <LogOut size={18} />
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}
