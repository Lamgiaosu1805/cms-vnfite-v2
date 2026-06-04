import { BarChart3, CircleDollarSign, LayoutDashboard, LogOut, Users } from 'lucide-react';
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
    <aside className="w-60 min-h-screen flex flex-col shrink-0 text-white"
      style={{ background: 'linear-gradient(180deg, #8B0A0A 0%, #A01515 100%)' }}>

      {/* Brand */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-md">
            <img src="/logo.png" alt="VNFITE" className="w-7 h-7 object-contain" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm leading-tight text-white">VNFITE CMS</p>
            <p className="text-xs text-red-200 truncate">{admin.fullName || admin.username}</p>
          </div>
        </div>
        {/* Role badge */}
        <div className="mt-3">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(232,160,48,0.2)', color: '#E8A030', border: '1px solid rgba(232,160,48,0.4)' }}
          >
            <BarChart3 size={11} />
            {admin.role}
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => onTabChange(key)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={activeTab === key ? {
              background: 'rgba(255,255,255,0.15)',
              color: '#ffffff',
              boxShadow: 'inset 2px 0 0 #E8A030',
            } : {
              color: 'rgba(255,255,255,0.7)',
            }}
            onMouseEnter={e => {
              if (activeTab !== key) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
            }}
            onMouseLeave={e => {
              if (activeTab !== key) (e.currentTarget as HTMLElement).style.background = '';
            }}
          >
            {icon}
            {label}
          </button>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all"
          style={{ color: 'rgba(255,255,255,0.6)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
        >
          <LogOut size={18} />
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}
