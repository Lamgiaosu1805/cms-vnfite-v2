import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchWithdrawalsForMonitoring,
  retryWithdrawal,
  resolveWithdrawal,
  type WithdrawalSummary,
  type WithdrawalMonitorStatus,
  type ResolveWithdrawalPayload,
} from '../api/client';
function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

const STATUS_LABEL: Record<WithdrawalMonitorStatus, string> = {
  INITIATED: 'Khởi tạo',
  OTP_PENDING: 'Chờ OTP',
  FUNDS_LOCKED: 'Đã khoá tiền',
  TRANSFER_INITIATED: 'Đang chuyển',
  PROCESSING: 'Đang xử lý',
  COMPLETED: 'Hoàn tất',
  TRANSFER_FAILED: 'Chuyển thất bại',
  FUNDS_RELEASED: 'Đã hoàn tiền',
  FAILED: 'Thất bại',
  CANCELLED: 'Đã huỷ',
};

const STATUS_COLOR: Record<WithdrawalMonitorStatus, string> = {
  INITIATED: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  OTP_PENDING: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  FUNDS_LOCKED: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  TRANSFER_INITIATED: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  PROCESSING: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  TRANSFER_FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  FUNDS_RELEASED: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  FAILED: 'bg-red-200 text-red-800 dark:bg-red-900/60 dark:text-red-300',
  CANCELLED: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
};

const ALL_STATUSES: WithdrawalMonitorStatus[] = [
  'INITIATED', 'OTP_PENDING', 'FUNDS_LOCKED', 'TRANSFER_INITIATED',
  'PROCESSING', 'COMPLETED', 'TRANSFER_FAILED', 'FUNDS_RELEASED', 'FAILED', 'CANCELLED',
];

const DEFAULT_STATUSES: WithdrawalMonitorStatus[] = ['TRANSFER_FAILED', 'FAILED', 'TRANSFER_INITIATED', 'PROCESSING'];

type ModalState =
  | { type: 'retry'; id: string; amount: number }
  | { type: 'resolve'; id: string; amount: number; wasSent?: boolean; ftNumber: string; note: string }
  | null;

export default function WithdrawalsMonitoringPage() {
  const [rows, setRows] = useState<WithdrawalSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatuses, setSelectedStatuses] = useState<Set<WithdrawalMonitorStatus>>(
    new Set(DEFAULT_STATUSES),
  );
  const [modal, setModal] = useState<ModalState>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const PAGE_SIZE = 20;

  const load = useCallback(async (p: number, statuses: Set<WithdrawalMonitorStatus>) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchWithdrawalsForMonitoring({
        statuses: statuses.size > 0 ? [...statuses] : undefined,
        page: p,
        size: PAGE_SIZE,
      });
      setRows(result.content);
      setTotal(result.totalElements);
    } catch (e: any) {
      setError(e.message ?? 'Không thể tải danh sách.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page, selectedStatuses); }, [page, selectedStatuses, load]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const toggleStatus = (s: WithdrawalMonitorStatus) => {
    setSelectedStatuses(prev => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
    setPage(0);
  };

  // Retry action
  const submitRetry = async (id: string) => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await retryWithdrawal(id);
      setSuccessMsg(res.message);
      setModal(null);
      load(page, selectedStatuses);
    } catch (e: any) {
      setActionError(e.message ?? 'Thao tác thất bại.');
    } finally {
      setActionLoading(false);
    }
  };

  // Resolve action
  const submitResolve = async (id: string, payload: ResolveWithdrawalPayload) => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await resolveWithdrawal(id, payload);
      setSuccessMsg(res.message);
      setModal(null);
      load(page, selectedStatuses);
    } catch (e: any) {
      setActionError(e.message ?? 'Thao tác thất bại.');
    } finally {
      setActionLoading(false);
    }
  };

  const canRetry = (s: WithdrawalMonitorStatus) =>
    s === 'TRANSFER_FAILED' || s === 'FAILED';
  const canResolve = (s: WithdrawalMonitorStatus) =>
    s === 'PROCESSING' || s === 'TRANSFER_INITIATED' || s === 'TRANSFER_FAILED' || s === 'FAILED';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Giám sát rút tiền</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Theo dõi và xử lý các lệnh rút tiền thất bại hoặc kẹt.
        </p>
      </div>

      {successMsg && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-sm">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-green-500 hover:text-green-700 dark:hover:text-green-200">✕</button>
        </div>
      )}

      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        {ALL_STATUSES.map(s => (
          <button
            key={s}
            onClick={() => toggleStatus(s)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
              selectedStatuses.has(s)
                ? 'border-[#C82020] bg-[#C82020] text-white dark:bg-[#C82020] dark:text-white'
                : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-[#C82020] hover:text-[#C82020] dark:hover:text-[#ff6b6b]'
            }`}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
        <button
          onClick={() => { setSelectedStatuses(new Set(DEFAULT_STATUSES)); setPage(0); }}
          className="px-3 py-1 rounded-full text-xs font-semibold border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-400 transition-all"
        >
          Đặt lại
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 dark:text-gray-500 text-sm gap-2">
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Đang tải...
          </div>
        ) : error ? (
          <div className="p-6 text-red-600 dark:text-red-400 text-sm text-center">{error}</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-gray-400 dark:text-gray-500 text-sm">Không có giao dịch nào khớp bộ lọc.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  {['ID yêu cầu', 'Khách hàng', 'Số tiền', 'Ngân hàng', 'Trạng thái', 'Mã MB FT', 'Lý do lỗi', 'Thời gian', 'Thao tác'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {rows.map(row => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-gray-600 dark:text-gray-400" title={row.id}>
                        {row.id.slice(0, 8)}…
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800 dark:text-gray-200">{row.customerPhone ?? '—'}</div>
                      {row.customerName && (
                        <div className="text-xs text-gray-400 dark:text-gray-500">{row.customerName}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">
                      {formatVND(row.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-700 dark:text-gray-300">{row.bankName ?? '—'}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 font-mono">{row.bankAccountNo ?? ''}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[row.status]}`}>
                        {STATUS_LABEL[row.status]}
                      </span>
                      {row.retryCount > 0 && (
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          Retry {row.retryCount}/{row.maxRetries}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                      {row.mbFtNumber ?? '—'}
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      {row.failureReason ? (
                        <span className="text-xs text-red-600 dark:text-red-400 line-clamp-2" title={row.failureReason}>
                          {row.failureReason}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                      {formatDateTime(row.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-nowrap">
                        {canRetry(row.status) && (
                          <button
                            onClick={() => { setActionError(null); setModal({ type: 'retry', id: row.id, amount: row.amount }); }}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/50 border border-orange-200 dark:border-orange-800 transition-colors whitespace-nowrap"
                          >
                            Retry
                          </button>
                        )}
                        {canResolve(row.status) && (
                          <button
                            onClick={() => { setActionError(null); setModal({ type: 'resolve', id: row.id, amount: row.amount, ftNumber: '', note: '' }); }}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 transition-colors whitespace-nowrap"
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>Tổng {total} bản ghi</span>
          <div className="flex items-center gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              ‹ Trước
            </button>
            <span className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 font-medium text-gray-700 dark:text-gray-300">
              {page + 1} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              Sau ›
            </button>
          </div>
        </div>
      )}

      {/* Retry modal */}
      {modal?.type === 'retry' && (
        <ConfirmModal
          title="Xác nhận Retry chuyển tiền"
          onClose={() => setModal(null)}
          onConfirm={() => submitRetry(modal.id)}
          loading={actionLoading}
          error={actionError}
          confirmLabel="Retry ngay"
          confirmClass="bg-orange-600 hover:bg-orange-700 text-white"
        >
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            Khởi động lại lệnh rút tiền <span className="font-mono font-semibold">{modal.id.slice(0, 8)}…</span>
            {' '}số tiền <span className="font-semibold">{formatVND(modal.amount)}</span>.
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
            ⚠ Chỉ retry khi đã xác nhận lệnh chưa được gửi đến MB Bank.
          </p>
        </ConfirmModal>
      )}

      {/* Resolve modal */}
      {modal?.type === 'resolve' && (
        <ConfirmModal
          title="Resolve giao dịch"
          onClose={() => setModal(null)}
          onConfirm={() => {
            if (modal.wasSent === undefined) {
              setActionError('Vui lòng chọn trạng thái giao dịch.');
              return;
            }
            if (modal.wasSent && !modal.ftNumber?.trim()) {
              setActionError('Số FT bắt buộc khi giao dịch đã được gửi.');
              return;
            }
            submitResolve(modal.id, {
              wasSent: modal.wasSent,
              ftNumber: modal.ftNumber?.trim() || undefined,
              note: modal.note?.trim() || undefined,
            });
          }}
          loading={actionLoading}
          error={actionError}
          confirmLabel="Xác nhận"
          confirmClass="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            Giao dịch <span className="font-mono font-semibold">{modal.id.slice(0, 8)}…</span>
            {' '}{formatVND(modal.amount)}
          </p>
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Trạng thái thực tế tại MB Bank:</p>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="radio"
                    name="wasSent"
                    className="accent-blue-600"
                    checked={modal.wasSent === true}
                    onChange={() => setModal(m => m?.type === 'resolve' ? { ...m, wasSent: true } : m)}
                  />
                  Đã chuyển thành công
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="radio"
                    name="wasSent"
                    className="accent-blue-600"
                    checked={modal.wasSent === false}
                    onChange={() => setModal(m => m?.type === 'resolve' ? { ...m, wasSent: false } : m)}
                  />
                  Chưa chuyển / cần hoàn tiền
                </label>
              </div>
            </div>
            {modal.wasSent && (
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">
                  Số FT MB Bank <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nhập số FT (vd: YFCH12345678)"
                  value={modal.ftNumber}
                  onChange={e => setModal(m => m?.type === 'resolve' ? { ...m, ftNumber: e.target.value } : m)}
                />
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">Ghi chú (tuỳ chọn)</label>
              <input
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Lý do xử lý thủ công..."
                value={modal.note}
                onChange={e => setModal(m => m?.type === 'resolve' ? { ...m, note: e.target.value } : m)}
              />
            </div>
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">
            ⚠ Thao tác này không thể hoàn tác. Chỉ thực hiện sau khi đã xác minh tại hệ thống ngân hàng.
          </p>
        </ConfirmModal>
      )}
    </div>
  );
}

// ─── Shared confirm modal ─────────────────────────────────────────────────────

interface ConfirmModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  error: string | null;
  confirmLabel: string;
  confirmClass: string;
}

function ConfirmModal({ title, children, onClose, onConfirm, loading, error, confirmLabel, confirmClass }: ConfirmModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70"
      onClick={e => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-lg">✕</button>
        </div>
        <div className="px-5 py-4">
          {children}
          {error && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Huỷ
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${confirmClass}`}
          >
            {loading ? 'Đang xử lý...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
