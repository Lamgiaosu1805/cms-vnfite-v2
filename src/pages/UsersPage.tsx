import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, ChevronLeft, ChevronRight, Eye, RefreshCw, Search, X } from 'lucide-react';
import {
  decideKyc,
  fetchCustomerDetail,
  fetchUsers,
  updateUserStatus,
  type CustomerDetail,
  type CmsUser,
} from '../api/client';
import { Badge } from '../components/Badge';

function formatDate(s: string | null | undefined) {
  if (!s) return '-';
  return new Date(s).toLocaleDateString('vi-VN');
}

function formatDateTime(s: string | null | undefined) {
  if (!s) return '-';
  return new Date(s).toLocaleString('vi-VN');
}

function formatMoney(n: number | null | undefined) {
  if (n == null) return '—';
  return new Intl.NumberFormat('vi-VN').format(n) + ' đ';
}

const transactionLabel: Record<string, string> = {
  DEPOSIT: 'Cộng tiền',
  WITHDRAW: 'Trừ tiền',
  INVEST: 'Đầu tư',
  INVEST_REFUND: 'Hoàn tiền đầu tư',
  REPAYMENT: 'Nhận hoàn trả',
};

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-gray-100 dark:border-gray-700/70 last:border-b-0">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</span>
      <span className="text-sm text-right text-gray-800 dark:text-gray-100">{value || '—'}</span>
    </div>
  );
}

interface ConfirmModalProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({ message, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-sm w-full">
        <p className="text-gray-800 dark:text-gray-100 mb-5">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300">Huỷ</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Xác nhận</button>
        </div>
      </div>
    </div>
  );
}

interface RejectModalProps {
  title: string;
  placeholder?: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

function ReasonModal({ title, placeholder, onConfirm, onCancel }: RejectModalProps) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-sm w-full">
        <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">{title}</h3>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={placeholder || 'Nhập lý do...'}
          rows={3}
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none mb-4 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
        />
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300">Huỷ</button>
          <button onClick={() => onConfirm(reason)} className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700">Xác nhận</button>
        </div>
      </div>
    </div>
  );
}

interface CustomerDetailPageProps {
  userId: string;
  onBack: () => void;
}

export function CustomerDetailPage({ userId, onBack }: CustomerDetailPageProps) {
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const profile = detail?.profile;

  useEffect(() => {
    let alive = true;
    void (async () => {
      setDetail(null);
      setError('');
      setLoading(true);
      try {
        const next = await fetchCustomerDetail(userId);
        if (alive) setDetail(next);
      } catch (err: unknown) {
        if (alive) setError(err instanceof Error ? err.message : 'Không thể tải chi tiết khách hàng');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-100 bg-white px-6 py-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">Chi tiết khách hàng</p>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50">
              {profile?.fullName || profile?.phone || 'Đang tải...'}
            </h2>
          </div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <ChevronLeft size={16} />
            Quay lại
          </button>
        </div>
      </div>

      <div className="space-y-5">
          {loading && (
            <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-6 text-center text-sm text-gray-500 dark:text-gray-400">
              <RefreshCw size={18} className="mr-2 inline animate-spin" />
              Đang tải thông tin khách hàng...
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {detail && (
            <>
              <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Số dư khả dụng</p>
                  <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-50">
                    {formatMoney(detail.wallet?.availableBalance)}
                  </p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    TK VNF: {detail.wallet?.vnfAccountNo || 'Chưa tạo ví'}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tổng giao dịch</p>
                  <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-50">
                    {detail.transactions.totalElements}
                  </p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Cộng/trừ tiền, đầu tư, hoàn tiền, hoàn trả</p>
                </div>
                <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Khoản gọi vốn</p>
                  <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-50">
                    {detail.loans.totalElements}
                  </p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Tất cả trạng thái của khách hàng</p>
                </div>
              </section>

              <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
                  <h3 className="mb-3 font-semibold text-gray-900 dark:text-gray-50">Thông tin cá nhân</h3>
                  <InfoRow label="Họ và tên" value={profile?.fullName || 'Chưa cập nhật'} />
                  <InfoRow label="Số điện thoại" value={profile?.phone} />
                  <InfoRow label="Email" value={profile?.email || '—'} />
                  <InfoRow label="Số CCCD" value={<span className="font-mono">{profile?.cccdNumber || '—'}</span>} />
                  <InfoRow label="Ngày sinh" value={formatDate(profile?.dateOfBirth)} />
                  <InfoRow label="Giới tính" value={profile?.gender || '—'} />
                  <InfoRow label="Quê quán" value={profile?.hometown || '—'} />
                  <InfoRow label="Địa chỉ thường trú" value={profile?.permanentAddress || '—'} />
                  <InfoRow label="Ngày cấp" value={formatDate(profile?.issueDate)} />
                  <InfoRow label="Nơi cấp" value={profile?.issuingAuthority || '—'} />
                  <InfoRow label="Ngày hết hạn" value={formatDate(profile?.expiryDate)} />
                  <InfoRow label="KYC" value={<Badge value={profile?.kycStatus || 'NONE'} />} />
                  <InfoRow label="Trạng thái" value={<Badge value={profile?.accountStatus || 'ACTIVE'} />} />
                  <InfoRow label="Ngày tạo" value={formatDateTime(profile?.createdAt)} />
                </div>

                <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
                  <h3 className="mb-3 font-semibold text-gray-900 dark:text-gray-50">Thông tin ví</h3>
                  <InfoRow label="Tài khoản VNF" value={detail.wallet?.vnfAccountNo || 'Chưa tạo ví'} />
                  <InfoRow label="Tổng số dư" value={formatMoney(detail.wallet?.totalBalance)} />
                  <InfoRow label="Đang phong tỏa" value={formatMoney(detail.wallet?.lockedBalance)} />
                  <InfoRow label="Số dư khả dụng" value={formatMoney(detail.wallet?.availableBalance)} />
                  <InfoRow label="Ngày tạo ví" value={formatDateTime(detail.wallet?.createdAt)} />
                </div>
              </section>

              <section className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-50">Lịch sử biến động giao dịch</h3>
                  <span className="text-xs text-gray-400 dark:text-gray-500">Hiển thị 30 giao dịch gần nhất</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-700 text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        <th className="py-2 text-left">Thời gian</th>
                        <th className="py-2 text-left">Loại</th>
                        <th className="py-2 text-left">Nội dung</th>
                        <th className="py-2 text-right">Số tiền</th>
                        <th className="py-2 text-right">Số dư khả dụng sau GD</th>
                        <th className="py-2 text-center">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-700/60">
                      {detail.transactions.content.map(tx => (
                        <tr key={tx.id}>
                          <td className="py-3 text-gray-500 dark:text-gray-400">{formatDateTime(tx.createdAt)}</td>
                          <td className="py-3 font-medium text-gray-800 dark:text-gray-100">{transactionLabel[tx.type] || tx.type}</td>
                          <td className="py-3 text-gray-600 dark:text-gray-300">{tx.description || '—'}</td>
                          <td className="py-3 text-right font-semibold text-gray-900 dark:text-gray-50">{formatMoney(tx.amount)}</td>
                          <td className="py-3 text-right text-gray-600 dark:text-gray-300">{formatMoney(tx.balanceAfter)}</td>
                          <td className="py-3 text-center"><Badge value={tx.status} /></td>
                        </tr>
                      ))}
                      {detail.transactions.content.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-gray-400 dark:text-gray-500">Chưa có giao dịch</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-50">Các khoản gọi vốn</h3>
                  <span className="text-xs text-gray-400 dark:text-gray-500">Hiển thị 30 khoản gần nhất</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-700 text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        <th className="py-2 text-left">Mã khoản</th>
                        <th className="py-2 text-left">Sản phẩm</th>
                        <th className="py-2 text-right">Số tiền</th>
                        <th className="py-2 text-center">Lãi suất</th>
                        <th className="py-2 text-center">Kỳ hạn</th>
                        <th className="py-2 text-center">Trạng thái</th>
                        <th className="py-2 text-right">Ngày tạo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-700/60">
                      {detail.loans.content.map(loan => (
                        <tr key={loan.loanId}>
                          <td className="py-3 font-mono font-semibold text-gray-900 dark:text-gray-50">{loan.loanCode || loan.loanId.slice(0, 8)}</td>
                          <td className="py-3 text-gray-700 dark:text-gray-200">{loan.productName || loan.purpose || '—'}</td>
                          <td className="py-3 text-right font-semibold text-gray-900 dark:text-gray-50">{formatMoney(loan.amount)}</td>
                          <td className="py-3 text-center text-gray-600 dark:text-gray-300">{loan.interestRate != null ? `${loan.interestRate}%` : '—'}</td>
                          <td className="py-3 text-center text-gray-600 dark:text-gray-300">{loan.termMonths} tháng</td>
                          <td className="py-3 text-center"><Badge value={loan.status} /></td>
                          <td className="py-3 text-right text-gray-500 dark:text-gray-400">{formatDate(loan.createdAt)}</td>
                        </tr>
                      ))}
                      {detail.loans.content.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-gray-400 dark:text-gray-500">Chưa có khoản gọi vốn</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
      </div>
    </div>
  );
}

interface UsersPageProps {
  onViewCustomer?: (user: CmsUser) => void;
}

export function UsersPage({ onViewCustomer }: UsersPageProps) {
  const [data, setData] = useState<{ content: CmsUser[]; totalElements: number; totalPages: number } | null>(null);
  const [search, setSearch] = useState('');
  const [kycFilter, setKycFilter] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  // Modals
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [rejectModal, setRejectModal] = useState<{ title: string; onConfirm: (r: string) => void } | null>(null);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const next = await fetchUsers({ search, kycStatus: kycFilter || undefined, page, size: 20 });
        if (alive) setData(next);
      } catch (err: unknown) {
        if (alive) setError(err instanceof Error ? err.message : 'Không thể tải danh sách khách hàng');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [search, kycFilter, page, refresh]);

  function handleSearchChange(value: string) {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearch(value);
      setPage(0);
    }, 400);
  }

  async function doAction(promise: Promise<void>) {
    try {
      await promise;
      setRefresh((r) => r + 1);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi thực hiện');
    }
  }

  function askApproveKyc(user: CmsUser) {
    setConfirmModal({
      message: `Duyệt KYC cho "${user.fullName || user.phone}"?`,
      onConfirm: () => {
        setConfirmModal(null);
        doAction(decideKyc(user.userId, 'APPROVED'));
      },
    });
  }

  function askRejectKyc(user: CmsUser) {
    setRejectModal({
      title: `Từ chối KYC "${user.fullName || user.phone}"`,
      onConfirm: (reason) => {
        setRejectModal(null);
        doAction(decideKyc(user.userId, 'REJECTED', reason));
      },
    });
  }

  function askToggleStatus(user: CmsUser) {
    const next = user.accountStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setConfirmModal({
      message: `${next === 'SUSPENDED' ? 'Khoá' : 'Mở khoá'} tài khoản "${user.fullName || user.phone}"?`,
      onConfirm: () => {
        setConfirmModal(null);
        doAction(updateUserStatus(user.userId, next));
      },
    });
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 flex-1 min-w-48 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700">
          <Search size={16} className="text-gray-400 dark:text-gray-500 shrink-0" />
          <input
            defaultValue={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Tìm theo tên, SĐT, email..."
            className="flex-1 text-sm outline-none bg-transparent dark:text-gray-100 dark:placeholder-gray-400"
          />
        </div>
        <select
          value={kycFilter}
          onChange={(e) => { setKycFilter(e.target.value); setPage(0); }}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100"
        >
          <option value="">Tất cả KYC</option>
          <option value="NONE">Chưa KYC</option>
          <option value="PENDING">Chờ duyệt</option>
          <option value="APPROVED">Đã duyệt</option>
          <option value="REJECTED">Từ chối</option>
        </select>
        <button onClick={() => setRefresh((r) => r + 1)} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {error && <p className="text-red-600 text-sm px-6 py-4 bg-red-50 dark:bg-red-900/20">{error}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <th className="text-left px-5 py-3.5">Tên khách hàng</th>
                <th className="text-center px-4 py-3.5">SĐT</th>
                <th className="text-center px-4 py-3.5">Số CCCD</th>
                <th className="text-center px-4 py-3.5">KYC</th>
                <th className="text-center px-4 py-3.5">Trạng thái</th>
                <th className="text-center px-4 py-3.5">Ngày tạo</th>
                <th className="text-center px-4 py-3.5">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {loading && !data && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400 dark:text-gray-500">
                  <RefreshCw size={18} className="animate-spin inline mr-2" /> Đang tải...
                </td></tr>
              )}
              {data?.content.map((user) => (
                <tr key={user.userId} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-gray-900 dark:text-gray-50">{user.fullName || <span className="text-gray-400 dark:text-gray-500 italic text-xs">Chưa cập nhật</span>}</p>
                    {user.email && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{user.email}</p>}
                  </td>
                  <td className="px-4 py-3.5 text-center text-gray-700 dark:text-gray-300">{user.phone || '-'}</td>
                  <td className="px-4 py-3.5 text-center text-gray-600 dark:text-gray-400 font-mono text-xs tracking-wide">
                    {user.cccdNumber || <span className="text-gray-300 dark:text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-center"><Badge value={user.kycStatus} /></td>
                  <td className="px-4 py-3.5 text-center"><Badge value={user.accountStatus} /></td>
                  <td className="px-4 py-3.5 text-center text-gray-400 dark:text-gray-500 text-xs">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => onViewCustomer?.(user)}
                        title="Xem chi tiết"
                        className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      >
                        <Eye size={15} />
                      </button>
                      {user.kycStatus === 'PENDING' && (
                        <>
                          <button
                            onClick={() => askApproveKyc(user)}
                            title="Duyệt KYC"
                            className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                          >
                            <Check size={15} />
                          </button>
                          <button
                            onClick={() => askRejectKyc(user)}
                            title="Từ chối KYC"
                            className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <X size={15} />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => askToggleStatus(user)}
                        className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
                          user.accountStatus === 'ACTIVE'
                            ? 'text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                            : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                        }`}
                      >
                        {user.accountStatus === 'ACTIVE' ? 'Khoá' : 'Mở khoá'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {data?.content.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400 dark:text-gray-500">Không có dữ liệu</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="px-5 py-3.5 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>Tổng {data.totalElements} khách hàng</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-2">Trang {page + 1} / {data.totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages - 1, p + 1))}
                disabled={page >= data.totalPages - 1}
                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {confirmModal && (
        <ConfirmModal
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
      {rejectModal && (
        <ReasonModal
          title={rejectModal.title}
          onConfirm={rejectModal.onConfirm}
          onCancel={() => setRejectModal(null)}
        />
      )}
    </div>
  );
}
