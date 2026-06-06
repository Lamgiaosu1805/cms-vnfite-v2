import { BarChart3, ChevronDown, CircleDollarSign, ClipboardList, LayoutDashboard, LogOut, ShieldCheck, Users } from 'lucide-react';
import type { AdminInfo } from '../api/client';
import { LOAN_STATUS_OPTIONS, type LoanStatusFilter } from '../loanConstants';

export type TabKey = 'dashboard' | 'users' | 'loans' | 'admins' | 'audit';

interface SidebarProps {
  admin: AdminInfo;
  activeTab: TabKey;
  activeLoanStatus: LoanStatusFilter;
  loanStatusCounts: Record<string, number>;
  onTabChange: (tab: TabKey) => void;
  onLoanStatusChange: (status: LoanStatusFilter) => void;
  onLogout: () => void;
}

export function Sidebar({
  admin,
  activeTab,
  activeLoanStatus,
  loanStatusCounts,
  onTabChange,
  onLoanStatusChange,
  onLogout,
}: SidebarProps) {
  const allItems: { key: TabKey; label: string; icon: React.ReactNode; roles?: string[] }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { key: 'users', label: 'Khách hàng', icon: <Users size={18} /> },
    { key: 'loans', label: 'Danh sách gọi vốn', icon: <CircleDollarSign size={18} /> },
    // Audit log: chỉ ADMIN và SUPER_ADMIN thấy được
    { key: 'audit', label: 'Nhật ký quyết định', icon: <ClipboardList size={18} />, roles: ['SUPER_ADMIN', 'ADMIN'] },
    { key: 'admins', label: 'Quản lý Admin', icon: <ShieldCheck size={18} />, roles: ['SUPER_ADMIN'] },
  ];
  const navItems = allItems.filter(item => !item.roles || item.roles.includes(admin.role));

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
        <div className="mt-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(232,160,48,0.2)', color: '#E8A030', border: '1px solid rgba(232,160,48,0.4)' }}>
            <BarChart3 size={11} />
            {admin.role}
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ key, label, icon }) => (
          <div key={key}>
            <button onClick={() => onTabChange(key)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={activeTab === key ? {
                background: 'rgba(255,255,255,0.15)', color: '#ffffff',
                boxShadow: 'inset 2px 0 0 #E8A030',
              } : { color: 'rgba(255,255,255,0.7)' }}
              onMouseEnter={e => { if (activeTab !== key) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
              onMouseLeave={e => { if (activeTab !== key) (e.currentTarget as HTMLElement).style.background = ''; }}>
              {icon}
              <span className="flex-1 text-left">{label}</span>
              {key === 'loans' && <ChevronDown size={14} className={activeTab === 'loans' ? 'opacity-90' : 'opacity-60'} />}
            </button>

            {key === 'loans' && activeTab === 'loans' && (
              <div className="mt-1.5 ml-4 space-y-0.5 border-l border-white/10 pl-2">
                {LOAN_STATUS_OPTIONS.map(item => {
                  const selected = activeLoanStatus === item.value;
                  return (
                    <button
                      key={item.value || 'all'}
                      type="button"
                      onClick={() => onLoanStatusChange(item.value)}
                      className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all"
                      style={selected
                        ? { background: 'rgba(255,255,255,0.14)', color: '#ffffff' }
                        : { color: 'rgba(255,255,255,0.65)' }}
                      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
                      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = ''; }}
                    >
                      <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                      <span className="min-w-7 rounded-full bg-white/10 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">
                        {loanStatusCounts[item.value] ?? 0}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-white/10">
        <button onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all"
          style={{ color: 'rgba(255,255,255,0.6)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>
          <LogOut size={18} />Đăng xuất
        </button>
      </div>
    </aside>
  );
}
