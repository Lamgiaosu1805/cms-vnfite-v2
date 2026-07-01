import { Fragment, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, ChevronLeft, ChevronRight, Copy, Eye, KeyRound, RefreshCw, Search, Smartphone, X } from 'lucide-react';
import {
  decideKyc,
  fetchCustomerDetailWithParams,
  fetchFileBlob,
  fetchUsers,
  getStoredAdmin,
  resetCustomerDevice,
  resetCustomerPassword,
  updateUserStatus,
  type CustomerDetail,
  type CmsUser,
  type ResetCustomerPasswordResult,
} from '../api/client';
import { Badge } from '../components/Badge';
import { formatVietnamDate, formatVietnamDateTime } from '../utils/dateTime';

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

const moneyInTypes = new Set(['DEPOSIT', 'INVEST_REFUND', 'REPAYMENT']);
const moneyOutTypes = new Set(['WITHDRAW', 'INVEST']);
const investmentStatusOptions = [
  { value: 'ACTIVE_PORTFOLIO', label: 'Đang hoạt động' },
  { value: 'COMPLETED', label: 'Đã hoàn thành' },
];

function isMoneyIn(type: string) {
  return moneyInTypes.has(type);
}

function isMoneyOut(type: string) {
  return moneyOutTypes.has(type);
}

function formatSignedMoney(type: string, amount: number | null | undefined) {
  const value = formatMoney(amount);
  if (amount == null) return value;
  if (isMoneyIn(type)) return `+${value}`;
  if (isMoneyOut(type)) return `-${value}`;
  return value;
}

function moneyDirectionClass(type: string) {
  if (isMoneyIn(type)) return 'text-emerald-600 dark:text-emerald-400';
  if (isMoneyOut(type)) return 'text-red-600 dark:text-red-400';
  return 'text-gray-900 dark:text-gray-50';
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-gray-100 dark:border-gray-700/70 last:border-b-0">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</span>
      <span className="text-sm text-right text-gray-800 dark:text-gray-100">{value || '—'}</span>
    </div>
  );
}

function KycImageCard({ title, fileId, portrait = false }: { title: string; fileId: string | null | undefined; portrait?: boolean }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!fileId) { setBlobUrl(null); setFailed(false); return; }
    let revoked = false;
    setFailed(false);
    setBlobUrl(null);
    fetchFileBlob(fileId)
      .then(url => { if (!revoked) setBlobUrl(url); })
      .catch(() => { if (!revoked) setFailed(true); });
    return () => {
      revoked = true;
      setBlobUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
    };
  }, [fileId]);

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/70">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</p>
        {fileId && (
          <span className="max-w-[180px] truncate font-mono text-[11px] text-gray-400 dark:text-gray-500" title={fileId}>
            {fileId}
          </span>
        )}
      </div>
      {blobUrl ? (
        <a href={blobUrl} target="_blank" rel="noreferrer" className="block">
          <img
            src={blobUrl}
            alt={title}
            className={`w-full rounded-lg border border-gray-100 bg-white object-cover shadow-sm dark:border-gray-700 dark:bg-gray-900 ${
              portrait ? 'aspect-[3/4] max-h-[320px]' : 'aspect-[16/10] max-h-[260px]'
            }`}
          />
        </a>
      ) : (
        <div className={`flex w-full items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white px-4 text-center text-sm text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-500 ${
          portrait ? 'aspect-[3/4] max-h-[320px]' : 'aspect-[16/10] max-h-[260px]'
        }`}>
          {failed ? 'Không tải được ảnh' : fileId ? 'Đang tải...' : 'Chưa có ảnh'}
        </div>
      )}
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

function canResetCustomers() {
  const role = getStoredAdmin()?.role;
  return role === 'SUPER_ADMIN' || role === 'ADMIN';
}

function ResetPasswordResultModal({
  result,
  onClose,
}: {
  result: ResetCustomerPasswordResult;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copyPassword() {
    await navigator.clipboard.writeText(result.generatedPassword);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">Reset mật khẩu khách hàng</p>
        <h3 className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-50">Mật khẩu tạm đã tạo</h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Khách hàng {result.phone || result.userId} cần đăng nhập lại bằng mật khẩu này.
        </p>
        <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">Mật khẩu tạm</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <code className="break-all font-mono text-lg font-bold text-gray-950 dark:text-gray-50">
              {result.generatedPassword}
            </code>
            <button
              onClick={copyPassword}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-white dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
            >
              <Copy size={15} />
              {copied ? 'Đã copy' : 'Copy'}
            </button>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Đóng
          </button>
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
  const [investmentPage, setInvestmentPage] = useState(0);
  const [investmentStatus, setInvestmentStatus] = useState('ACTIVE_PORTFOLIO');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<'password' | 'device' | null>(null);
  const [error, setError] = useState('');
  const [resetPasswordResult, setResetPasswordResult] = useState<ResetCustomerPasswordResult | null>(null);
  const profile = detail?.profile;
  const showAdminReset = canResetCustomers();
  const investmentPageData = detail?.investments?.investmentHistoryPage;

  useEffect(() => {
    let alive = true;
    void (async () => {
      setDetail(null);
      setError('');
      setLoading(true);
      try {
        const next = await fetchCustomerDetailWithParams(userId, {
          investmentPage,
          investmentSize: 10,
          investmentStatus,
        });
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
  }, [userId, investmentPage, investmentStatus]);

  async function handleResetPassword() {
    if (!window.confirm(`Reset mật khẩu khách hàng "${profile?.fullName || profile?.phone || userId}"?`)) return;
    setActionLoading('password');
    setError('');
    try {
      const result = await resetCustomerPassword(userId);
      setResetPasswordResult(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể reset mật khẩu khách hàng');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleResetDevice() {
    if (!window.confirm(`Reset thiết bị đăng nhập của khách hàng "${profile?.fullName || profile?.phone || userId}"?`)) return;
    setActionLoading('device');
    setError('');
    try {
      await resetCustomerDevice(userId);
      alert('Đã reset thiết bị khách hàng. Khách cần đăng nhập lại.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể reset thiết bị khách hàng');
    } finally {
      setActionLoading(null);
    }
  }

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
          <div className="flex flex-wrap justify-end gap-2">
            {showAdminReset && (
              <>
                <button
                  onClick={handleResetPassword}
                  disabled={!!actionLoading}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/40"
                >
                  <KeyRound size={16} />
                  {actionLoading === 'password' ? 'Đang reset...' : 'Reset mật khẩu'}
                </button>
                <button
                  onClick={handleResetDevice}
                  disabled={!!actionLoading}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <Smartphone size={16} />
                  {actionLoading === 'device' ? 'Đang reset...' : 'Reset thiết bị'}
                </button>
              </>
            )}
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <ChevronLeft size={16} />
              Quay lại
            </button>
          </div>
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
              <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
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
                <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Đã đầu tư</p>
                  <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-50">
                    {formatMoney(detail.investments?.summary?.totalInvested)}
                  </p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    {detail.investments?.investmentHistoryPage?.totalElements
                      ?? detail.investments?.investmentHistory?.length
                      ?? 0} khoản đầu tư
                  </p>
                </div>
              </section>

              <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
                  <h3 className="mb-3 font-semibold text-gray-900 dark:text-gray-50">Thông tin cá nhân</h3>
                  <InfoRow label="Họ và tên" value={profile?.fullName || 'Chưa cập nhật'} />
                  <InfoRow label="Số điện thoại" value={profile?.phone} />
                  <InfoRow label="Email" value={profile?.email || '—'} />
                  <InfoRow label="Số CCCD" value={<span className="font-mono">{profile?.cccdNumber || '—'}</span>} />
                  <InfoRow label="Ngày sinh" value={formatVietnamDate(profile?.dateOfBirth, '-')} />
                  <InfoRow label="Giới tính" value={profile?.gender || '—'} />
                  <InfoRow label="Quê quán" value={profile?.hometown || '—'} />
                  <InfoRow label="Địa chỉ thường trú" value={profile?.permanentAddress || '—'} />
                  <InfoRow label="Ngày cấp" value={formatVietnamDate(profile?.issueDate, '-')} />
                  <InfoRow label="Nơi cấp" value={profile?.issuingAuthority || '—'} />
                  <InfoRow label="Ngày hết hạn" value={formatVietnamDate(profile?.expiryDate, '-')} />
                  <InfoRow label="KYC" value={<Badge value={profile?.kycStatus || 'NONE'} />} />
                  <InfoRow label="Trạng thái" value={<Badge value={profile?.accountStatus || 'ACTIVE'} />} />
                  <InfoRow label="Ngày tạo" value={formatVietnamDateTime(profile?.createdAt, '-')} />
                </div>

                <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
                  <h3 className="mb-3 font-semibold text-gray-900 dark:text-gray-50">Thông tin ví</h3>
                  <InfoRow label="Tài khoản VNF" value={detail.wallet?.vnfAccountNo || 'Chưa tạo ví'} />
                  <InfoRow label="Tổng số dư" value={formatMoney(detail.wallet?.totalBalance)} />
                  <InfoRow label="Đang phong tỏa" value={formatMoney(detail.wallet?.lockedBalance)} />
                  <InfoRow label="Số dư khả dụng" value={formatMoney(detail.wallet?.availableBalance)} />
                  <InfoRow label="Ngày tạo ví" value={formatVietnamDateTime(detail.wallet?.createdAt, '-')} />
                </div>
              </section>

              <section className="rounded-xl border border-gray-100 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-50">Ảnh eKYC</h3>
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      Dữ liệu lấy từ fileId trong kyc_submissions. Bấm vào ảnh để mở kích thước đầy đủ.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                  <KycImageCard title="CCCD mặt trước" fileId={profile?.frontImageId} />
                  <KycImageCard title="CCCD mặt sau" fileId={profile?.backImageId} />
                  <KycImageCard title="Ảnh chân dung" fileId={profile?.portraitImageId} portrait />
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
                          <td className="py-3 text-gray-500 dark:text-gray-400">{formatVietnamDateTime(tx.createdAt, '-')}</td>
                          <td className="py-3">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                              isMoneyIn(tx.type)
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : isMoneyOut(tx.type)
                                  ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                            }`}>
                              {transactionLabel[tx.type] || tx.type}
                            </span>
                          </td>
                          <td className="py-3 text-gray-600 dark:text-gray-300">{tx.description || '—'}</td>
                          <td className={`py-3 text-right font-semibold ${moneyDirectionClass(tx.type)}`}>
                            {formatSignedMoney(tx.type, tx.amount)}
                          </td>
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
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-50">Danh mục đầu tư</h3>
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      Các khoản khách hàng đang/đã đầu tư, lấy từ loan_offers của loan-service.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-start justify-end gap-3">
                    <select
                      value={investmentStatus}
                      onChange={(e) => {
                        setInvestmentStatus(e.target.value);
                        setInvestmentPage(0);
                      }}
                      className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 outline-none transition focus:border-red-300 focus:ring-2 focus:ring-red-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:focus:border-red-800 dark:focus:ring-red-950/50"
                    >
                      {investmentStatusOptions.map(option => (
                        <option key={option.value || 'all'} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mb-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                    <div>
                      <p className="text-gray-400 dark:text-gray-500">Dự kiến nhận</p>
                      <p className="font-semibold text-gray-900 dark:text-gray-50">
                        {formatMoney(detail.investments?.summary?.totalReturnsExpected)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 dark:text-gray-500">Đã nhận</p>
                      <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatMoney(detail.investments?.summary?.totalReturnsPaid)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 dark:text-gray-500">Kỳ gần nhất</p>
                      <p className="font-semibold text-gray-900 dark:text-gray-50">
                        {detail.investments?.summary?.nextPaymentDate
                          ? `${formatVietnamDate(detail.investments.summary.nextPaymentDate)} · ${formatMoney(detail.investments.summary.nextPaymentAmount)}`
                          : '—'}
                      </p>
                    </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-700 text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        <th className="py-2 text-left">Mã khoản</th>
                        <th className="py-2 text-left">Người gọi vốn</th>
                        <th className="py-2 text-right">Số tiền đầu tư</th>
                        <th className="py-2 text-center">Lãi suất</th>
                        <th className="py-2 text-center">Kỳ hạn</th>
                        <th className="py-2 text-center">Trạng thái khoản</th>
                        <th className="py-2 text-right">Ngày đầu tư</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-700/60">
                      {(investmentPageData?.content ?? detail.investments?.investmentHistory ?? []).map(item => (
                        <tr key={item.offerId}>
                          <td className="py-3 font-mono font-semibold text-gray-900 dark:text-gray-50">
                            {item.loanCode || item.loanId?.slice(0, 8) || '—'}
                          </td>
                          <td className="py-3">
                            <div className="max-w-[220px]" title={[item.borrowerName, item.borrowerPhone].filter(Boolean).join(' · ')}>
                              <p className="truncate font-semibold text-gray-900 dark:text-gray-50">
                                {item.borrowerName || item.borrowerPhone || 'Chưa xác định'}
                              </p>
                              {item.borrowerPhone && (
                                <p className="mt-0.5 font-mono text-xs text-gray-400 dark:text-gray-500">{item.borrowerPhone}</p>
                              )}
                            </div>
                          </td>
                          <td className="py-3 text-right font-semibold text-gray-900 dark:text-gray-50">
                            {formatMoney(item.amount)}
                          </td>
                          <td className="py-3 text-center text-gray-600 dark:text-gray-300">
                            {item.interestRate != null ? `${item.interestRate}%` : '—'}
                          </td>
                          <td className="py-3 text-center text-gray-600 dark:text-gray-300">
                            {item.termMonths != null ? `${item.termMonths} tháng` : '—'}
                          </td>
                          <td className="py-3 text-center"><Badge value={item.loanStatus} /></td>
                          <td className="py-3 text-right text-gray-500 dark:text-gray-400">
                            {formatVietnamDateTime(item.investedAt, '-')}
                          </td>
                        </tr>
                      ))}
                      {(investmentPageData?.content?.length ?? detail.investments?.investmentHistory?.length ?? 0) === 0 && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-gray-400 dark:text-gray-500">
                            Khách hàng chưa có khoản đầu tư
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {investmentPageData && investmentPageData.totalElements > investmentPageData.size && (
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    <span>
                      Hiển thị {investmentPageData.content.length} / {investmentPageData.totalElements} khoản đầu tư
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={investmentPage <= 0}
                        onClick={() => setInvestmentPage(page => Math.max(page - 1, 0))}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-200"
                      >
                        Trước
                      </button>
                      <span className="min-w-[72px] text-center">
                        {investmentPageData.page + 1}/{Math.max(investmentPageData.totalPages, 1)}
                      </span>
                      <button
                        type="button"
                        disabled={investmentPageData.last}
                        onClick={() => setInvestmentPage(page => page + 1)}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-200"
                      >
                        Sau
                      </button>
                    </div>
                  </div>
                )}
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
                        <Fragment key={loan.loanId}>
                          <tr>
                            <td className="py-3 font-mono font-semibold text-gray-900 dark:text-gray-50">{loan.loanCode || loan.loanId.slice(0, 8)}</td>
                            <td className="py-3 text-gray-700 dark:text-gray-200">{loan.productName || 'Chưa xác định'}</td>
                            <td className="py-3 text-right font-semibold text-gray-900 dark:text-gray-50">{formatMoney(loan.amount)}</td>
                            <td className="py-3 text-center text-gray-600 dark:text-gray-300">{loan.interestRate != null ? `${loan.interestRate}%` : '—'}</td>
                            <td className="py-3 text-center text-gray-600 dark:text-gray-300">{loan.termMonths} tháng</td>
                            <td className="py-3 text-center"><Badge value={loan.status} /></td>
                            <td className="py-3 text-right text-gray-500 dark:text-gray-400">{formatVietnamDateTime(loan.createdAt, '-')}</td>
                          </tr>
                          <tr>
                            <td colSpan={7} className="pb-4">
                              <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/40">
                                <div className="mb-2 flex items-center justify-between gap-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                    Nhà đầu tư của khoản này
                                  </p>
                                  <p className="text-xs text-gray-400 dark:text-gray-500">
                                    {(loan.offers ?? []).length} nhà đầu tư · {formatMoney((loan.offers ?? []).reduce((sum, offer) => sum + (offer.amount ?? 0), 0))}
                                  </p>
                                </div>
                                {(loan.offers ?? []).length > 0 ? (
                                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                    {(loan.offers ?? []).map(offer => (
                                      <div
                                        key={offer.offerId}
                                        className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                                      >
                                        <div className="min-w-0">
                                          <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-50" title={offer.investorName || offer.investorPhone || ''}>
                                            {offer.investorName || offer.investorPhone || 'Chưa xác định'}
                                          </p>
                                          {offer.investorPhone && (
                                            <p className="mt-0.5 font-mono text-xs text-gray-400 dark:text-gray-500">{offer.investorPhone}</p>
                                          )}
                                        </div>
                                        <div className="shrink-0 text-right">
                                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">{formatMoney(offer.amount)}</p>
                                          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{offer.status || '—'}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-400 dark:text-gray-500">Chưa có nhà đầu tư</p>
                                )}
                              </div>
                            </td>
                          </tr>
                        </Fragment>
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
      {resetPasswordResult && (
        <ResetPasswordResultModal
          result={resetPasswordResult}
          onClose={() => setResetPasswordResult(null)}
        />
      )}
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
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [resetPasswordResult, setResetPasswordResult] = useState<ResetCustomerPasswordResult | null>(null);
  const showAdminReset = canResetCustomers();

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

  async function doCustomerResetPassword(user: CmsUser) {
    setActionLoading(`password:${user.userId}`);
    try {
      const result = await resetCustomerPassword(user.userId);
      setResetPasswordResult(result);
      setRefresh((r) => r + 1);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Không thể reset mật khẩu khách hàng');
    } finally {
      setActionLoading(null);
    }
  }

  async function doCustomerResetDevice(user: CmsUser) {
    setActionLoading(`device:${user.userId}`);
    try {
      await resetCustomerDevice(user.userId);
      alert('Đã reset thiết bị khách hàng. Khách cần đăng nhập lại.');
      setRefresh((r) => r + 1);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Không thể reset thiết bị khách hàng');
    } finally {
      setActionLoading(null);
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

  function askResetPassword(user: CmsUser) {
    setConfirmModal({
      message: `Reset mật khẩu khách hàng "${user.fullName || user.phone}"? Khách sẽ cần đăng nhập lại bằng mật khẩu tạm.`,
      onConfirm: () => {
        setConfirmModal(null);
        void doCustomerResetPassword(user);
      },
    });
  }

  function askResetDevice(user: CmsUser) {
    setConfirmModal({
      message: `Reset thiết bị đăng nhập của khách hàng "${user.fullName || user.phone}"? Phiên hiện tại và sinh trắc học sẽ bị thu hồi.`,
      onConfirm: () => {
        setConfirmModal(null);
        void doCustomerResetDevice(user);
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
                  <td className="px-4 py-3.5 text-center text-gray-400 dark:text-gray-500 text-xs">{formatVietnamDateTime(user.createdAt, '-')}</td>
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
                      {showAdminReset && (
                        <>
                          <button
                            onClick={() => askResetPassword(user)}
                            disabled={actionLoading === `password:${user.userId}`}
                            title="Reset mật khẩu khách hàng"
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60 dark:text-red-300 dark:hover:bg-red-950/40"
                          >
                            <KeyRound size={13} />
                            MK
                          </button>
                          <button
                            onClick={() => askResetDevice(user)}
                            disabled={actionLoading === `device:${user.userId}`}
                            title="Reset thiết bị khách hàng"
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 disabled:opacity-60 dark:text-gray-300 dark:hover:bg-gray-700"
                          >
                            <Smartphone size={13} />
                            TB
                          </button>
                        </>
                      )}
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
      {resetPasswordResult && (
        <ResetPasswordResultModal
          result={resetPasswordResult}
          onClose={() => setResetPasswordResult(null)}
        />
      )}
    </div>
  );
}
