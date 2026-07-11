import { useEffect, useState } from 'react';
import { ArrowDownUp, BarChart3, Briefcase, Building2, CalendarCheck, ChevronDown, CircleDollarSign, ClipboardList, LayoutDashboard, LogOut, Newspaper, Package, ShieldCheck, Users, Wallet, Scale, CalendarClock, Receipt, BadgeCheck } from 'lucide-react';
import { adminRoles, adminHasPermission, CMS_ROLE_LABELS, type AdminInfo } from '../api/client';
import { LOAN_STATUS_OPTIONS, type LoanStatusFilter } from '../loanConstants';

export type TabKey = 'dashboard' | 'users' | 'business-kyc' | 'transactions' | 'loans' | 'business-loans' | 'products' | 'news' | 'recruitment' | 'admins' | 'audit' | 'withdrawals' | 'reconciliation' | 'auto-debit-audit' | 'distribution-log' | 'fee-revenue' | 'due-today' | 'early-settlements';

interface SidebarProps {
  admin: AdminInfo;
  activeTab: TabKey;
  activeLoanStatus: LoanStatusFilter;
  activeBusinessLoanStatus: LoanStatusFilter;
  loanStatusCounts: Record<string, number>;
  businessLoanStatusCounts: Record<string, number>;
  onTabChange: (tab: TabKey) => void;
  onLoanStatusChange: (status: LoanStatusFilter) => void;
  onBusinessLoanStatusChange: (status: LoanStatusFilter) => void;
  onLogout: () => void;
}

export function Sidebar({
  admin,
  activeTab,
  activeLoanStatus,
  activeBusinessLoanStatus,
  loanStatusCounts,
  businessLoanStatusCounts,
  onTabChange,
  onLoanStatusChange,
  onBusinessLoanStatusChange,
  onLogout,
}: SidebarProps) {
  const [loanMenuOpen, setLoanMenuOpen] = useState(activeTab === 'loans');
  const [businessLoanMenuOpen, setBusinessLoanMenuOpen] = useState(activeTab === 'business-loans');

  useEffect(() => {
    if (activeTab !== 'loans') setLoanMenuOpen(false);
    if (activeTab !== 'business-loans') setBusinessLoanMenuOpen(false);
  }, [activeTab]);

  // roles của mỗi mục = tập vai trò được phép (khớp @PreAuthorize backend).
  // permissions = quyền lẻ cũng mở được mục này (vd: được cấp loan.approve dù không có vai trò phòng ban).
  const allItems: { key: TabKey; label: string; icon: React.ReactNode; roles?: string[]; permissions?: string[] }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} />, roles: ['SUPER_ADMIN', 'ADMIN', 'OPS', 'APPRAISER', 'APPROVER', 'FINANCE', 'CUSTOMER_SUPPORT'] },
    { key: 'users', label: 'Khách hàng', icon: <Users size={18} />, roles: ['SUPER_ADMIN', 'ADMIN', 'OPS', 'CUSTOMER_SUPPORT'], permissions: ['kyc.decide'] },
    { key: 'business-kyc', label: 'Hồ sơ doanh nghiệp', icon: <Building2 size={18} />, roles: ['SUPER_ADMIN', 'ADMIN', 'CUSTOMER_SUPPORT'], permissions: ['business.decide'] },
    { key: 'transactions', label: 'Giao dịch nạp/rút', icon: <ArrowDownUp size={18} />, roles: ['SUPER_ADMIN', 'ADMIN', 'OPS', 'FINANCE'] },
    { key: 'loans', label: 'Gọi vốn cá nhân', icon: <CircleDollarSign size={18} />, roles: ['SUPER_ADMIN', 'ADMIN', 'OPS', 'APPRAISER', 'APPROVER', 'FINANCE'], permissions: ['loan.approve', 'loan.disburse', 'loan.propose'] },
    { key: 'business-loans', label: 'Gọi vốn DN / Hộ KD', icon: <Building2 size={18} />, roles: ['SUPER_ADMIN', 'ADMIN', 'OPS', 'APPRAISER', 'APPROVER', 'FINANCE'], permissions: ['loan.approve', 'loan.disburse', 'loan.propose'] },
    { key: 'products', label: 'Sản phẩm gọi vốn', icon: <Package size={18} />, roles: ['SUPER_ADMIN', 'ADMIN', 'APPROVER'], permissions: ['loan.product.edit'] },
    { key: 'news', label: 'Tin tức', icon: <Newspaper size={18} />, roles: ['SUPER_ADMIN', 'ADMIN', 'CONTENT'] },
    { key: 'recruitment', label: 'Tuyển dụng', icon: <Briefcase size={18} />, roles: ['SUPER_ADMIN', 'ADMIN', 'HR'] },
    { key: 'withdrawals', label: 'Giám sát rút tiền', icon: <Wallet size={18} />, roles: ['SUPER_ADMIN', 'ADMIN', 'OPS', 'FINANCE'] },
    { key: 'reconciliation', label: 'Tra soát giao dịch', icon: <Scale size={18} />, roles: ['SUPER_ADMIN', 'ADMIN', 'OPS', 'FINANCE'], permissions: ['finance.reconcile'] },
    { key: 'due-today', label: 'Đến hạn hôm nay', icon: <CalendarCheck size={18} />, roles: ['SUPER_ADMIN', 'ADMIN', 'OPS', 'FINANCE', 'APPROVER'] },
    { key: 'auto-debit-audit', label: 'Lịch sử thu nợ tự động', icon: <CalendarClock size={18} />, roles: ['SUPER_ADMIN', 'ADMIN', 'OPS', 'FINANCE', 'APPROVER'] },
    { key: 'distribution-log', label: 'Phân bổ & thuế TNCN', icon: <Receipt size={18} />, roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE'] },
    { key: 'fee-revenue', label: 'Doanh thu phí', icon: <BarChart3 size={18} />, roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE'] },
    { key: 'early-settlements', label: 'Tất toán sớm', icon: <BadgeCheck size={18} />, roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'APPROVER'] },
    { key: 'audit', label: 'Nhật ký quyết định', icon: <ClipboardList size={18} />, roles: ['SUPER_ADMIN', 'ADMIN', 'APPROVER', 'APPRAISER'] },
    { key: 'admins', label: 'Quản lý Admin', icon: <ShieldCheck size={18} />, roles: ['SUPER_ADMIN'] },
  ];
  const myRoles = adminRoles(admin);
  const navItems = allItems.filter(item =>
    !item.roles
    || item.roles.some(r => myRoles.includes(r))
    || (item.permissions ?? []).some(p => adminHasPermission(admin, p)));

  return (
    <aside className="w-60 h-full overflow-y-auto flex flex-col shrink-0 text-white"
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
            style={{ background: 'rgba(232,160,48,0.2)', color: '#E8A030', border: '1px solid rgba(232,160,48,0.4)' }}
            title={myRoles.map(r => CMS_ROLE_LABELS[r] ?? r).join(', ')}>
            <BarChart3 size={11} />
            {CMS_ROLE_LABELS[admin.role] ?? admin.role}
            {myRoles.length > 1 && ` +${myRoles.length - 1}`}
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ key, label, icon }) => (
          <div key={key}>
            <button onClick={() => {
              if (key === 'loans') {
                if (activeTab === 'loans') {
                  setLoanMenuOpen(value => !value);
                } else {
                  setLoanMenuOpen(true);
                  onTabChange(key);
                }
                return;
              }
              if (key === 'business-loans') {
                if (activeTab === 'business-loans') {
                  setBusinessLoanMenuOpen(value => !value);
                } else {
                  setBusinessLoanMenuOpen(true);
                  onTabChange(key);
                }
                return;
              }
              onTabChange(key);
            }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={activeTab === key ? {
                background: 'rgba(255,255,255,0.15)', color: '#ffffff',
                boxShadow: 'inset 2px 0 0 #E8A030',
              } : { color: 'rgba(255,255,255,0.7)' }}
              onMouseEnter={e => { if (activeTab !== key) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
              onMouseLeave={e => { if (activeTab !== key) (e.currentTarget as HTMLElement).style.background = ''; }}>
              {icon}
              <span className="flex-1 text-left">{label}</span>
              {key === 'loans' && (
                <ChevronDown
                  size={14}
                  className={`transition-transform ${activeTab === 'loans' ? 'opacity-90' : 'opacity-60'} ${loanMenuOpen ? 'rotate-180' : ''}`}
                />
              )}
              {key === 'business-loans' && (
                <ChevronDown
                  size={14}
                  className={`transition-transform ${activeTab === 'business-loans' ? 'opacity-90' : 'opacity-60'} ${businessLoanMenuOpen ? 'rotate-180' : ''}`}
                />
              )}
            </button>

            {key === 'loans' && activeTab === 'loans' && loanMenuOpen && (
              <div className="mt-1.5 ml-4 space-y-0.5 border-l border-white/10 pl-2">
                {LOAN_STATUS_OPTIONS.map(item => {
                  const selected = activeLoanStatus === item.value;
                  return (
                    <button
                      key={item.value || 'all'}
                      type="button"
                      onClick={() => {
                        setLoanMenuOpen(true);
                        onLoanStatusChange(item.value);
                      }}
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

            {key === 'business-loans' && activeTab === 'business-loans' && businessLoanMenuOpen && (
              <div className="mt-1.5 ml-4 space-y-0.5 border-l border-white/10 pl-2">
                {LOAN_STATUS_OPTIONS.map(item => {
                  const selected = activeBusinessLoanStatus === item.value;
                  return (
                    <button
                      key={item.value || 'all-business'}
                      type="button"
                      onClick={() => {
                        setBusinessLoanMenuOpen(true);
                        onBusinessLoanStatusChange(item.value);
                      }}
                      className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all"
                      style={selected
                        ? { background: 'rgba(255,255,255,0.14)', color: '#ffffff' }
                        : { color: 'rgba(255,255,255,0.65)' }}
                      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
                      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = ''; }}
                    >
                      <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                      <span className="min-w-7 rounded-full bg-white/10 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">
                        {businessLoanStatusCounts[item.value] ?? 0}
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
