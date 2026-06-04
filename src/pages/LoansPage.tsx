import { useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, RefreshCw, X } from 'lucide-react';
import { approveLoan, fetchLoans, rejectLoan, type CmsLoan } from '../api/client';
import { Badge } from '../components/Badge';

function formatMoney(value: number | string | undefined) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(s: string | null | undefined) {
  if (!s) return '-';
  return new Date(s).toLocaleDateString('vi-VN');
}

function shortId(id: string | null | undefined) {
  if (!id) return '-';
  return id.length > 8 ? id.slice(0, 8) + '…' : id;
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function ApproveModal({ loan, onConfirm, onCancel }: {
  loan: CmsLoan;
  onConfirm: (rate: number, notes: string) => void;
  onCancel: () => void;
}) {
  const [rate, setRate] = useState('');
  const [notes, setNotes] = useState('');
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
        <h3 className="font-semibold text-gray-800 mb-4">Phê duyệt khoản gọi vốn</h3>
        <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-gray-500">Số tiền</span><strong>{formatMoney(loan.amount)}</strong></div>
          <div className="flex justify-between"><span className="text-gray-500">Kỳ hạn</span><strong>{loan.termMonths} tháng</strong></div>
          {loan.productName && <div className="flex justify-between"><span className="text-gray-500">Sản phẩm</span><strong>{loan.productName}</strong></div>}
          {loan.purpose && <div className="flex justify-between"><span className="text-gray-500">Mục đích</span><strong>{loan.purpose}</strong></div>}
        </div>
        <p className="text-sm text-gray-500 mb-4">Nhập lãi suất thẩm định (%/năm) — sẽ gửi cho người vay xác nhận.</p>
        <div className="space-y-3 mb-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lãi suất thẩm định (%/năm)</label>
            <input type="number" step="0.1" min="1" max="50" value={rate}
              onChange={e => setRate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú (tuỳ chọn)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Huỷ</button>
          <button onClick={() => onConfirm(parseFloat(rate), notes)}
            disabled={!rate || isNaN(parseFloat(rate))}
            className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
            Gửi phê duyệt
          </button>
        </div>
      </div>
    </div>
  );
}

function RejectModal({ loan, onConfirm, onCancel }: {
  loan: CmsLoan;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
        <h3 className="font-semibold text-gray-800 mb-3">Từ chối khoản gọi vốn</h3>
        <p className="text-xs text-gray-400 mb-3">Mã: {loan.loanCode || shortId(loan.loanId)}</p>
        <textarea value={reason} onChange={e => setReason(e.target.value)}
          placeholder="Lý do từ chối..." rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none mb-4" />
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Huỷ</button>
          <button onClick={() => onConfirm(reason)} disabled={!reason.trim()}
            className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
            Từ chối
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LOAN_STATUSES = [
  { value: '', label: 'Tất cả' },
  { value: 'PENDING_REVIEW', label: 'Chờ thẩm định' },
  { value: 'AWAITING_BORROWER_APPROVAL', label: 'Chờ người vay xác nhận' },
  { value: 'ACTIVE', label: 'Đang gọi vốn' },
  { value: 'FUNDED', label: 'Đã fund' },
  { value: 'REPAYING', label: 'Đang trả nợ' },
  { value: 'COMPLETED', label: 'Hoàn thành' },
  { value: 'REJECTED', label: 'Từ chối' },
  { value: 'CANCELLED', label: 'Đã huỷ' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export function LoansPage() {
  const [data, setData] = useState<{ content: CmsLoan[]; totalElements: number; totalPages: number } | null>(null);
  const [status, setStatus] = useState('PENDING_REVIEW');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [approveModal, setApproveModal] = useState<CmsLoan | null>(null);
  const [rejectModal, setRejectModal] = useState<CmsLoan | null>(null);

  useEffect(() => {
    setLoading(true);
    setError('');
    fetchLoans({ status: status || undefined, page, size: 20 })
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [status, page, refresh]);

  async function doAction(promise: Promise<void>) {
    try {
      await promise;
      setRefresh(r => r + 1);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi thực hiện');
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-3 items-center">
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500">
          {LOAN_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button onClick={() => setRefresh(r => r + 1)} className="p-2 text-gray-400 hover:text-gray-600">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
        {data && <span className="text-sm text-gray-400 ml-auto">Tổng {data.totalElements} khoản</span>}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {error && <p className="text-red-600 text-sm px-6 py-4 bg-red-50">{error}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="text-left px-5 py-3.5">Khoản gọi vốn</th>
                <th className="text-center px-4 py-3.5">Số tiền</th>
                <th className="text-center px-4 py-3.5">Lãi suất</th>
                <th className="text-center px-4 py-3.5">Kỳ hạn</th>
                <th className="text-center px-4 py-3.5">Trạng thái</th>
                <th className="text-center px-4 py-3.5">Ngày tạo</th>
                <th className="text-center px-4 py-3.5">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && !data && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">
                  <RefreshCw size={18} className="animate-spin inline mr-2" />Đang tải...
                </td></tr>
              )}
              {data?.content.map(loan => (
                <tr key={loan.loanId} className="hover:bg-gray-50/70 transition-colors">
                  {/* Cột trái: mã + người vay + sản phẩm */}
                  <td className="px-5 py-3.5">
                    <p className="font-semibold text-gray-900 text-xs font-mono tracking-wide">
                      {loan.loanCode ?? shortId(loan.loanId)}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                      <span className="text-gray-400">Người vay:</span>
                      <span className="font-mono">{shortId(loan.borrowerId)}</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[220px]">
                      {loan.productName ?? loan.purpose ?? '—'}
                    </p>
                  </td>

                  <td className="px-4 py-3.5 text-center font-semibold text-gray-800">
                    {formatMoney(loan.amount)}
                  </td>
                  <td className="px-4 py-3.5 text-center text-gray-600">
                    {loan.interestRate != null
                      ? <span className="font-medium">{loan.interestRate}%</span>
                      : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-center text-gray-600">
                    {loan.termMonths} tháng
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <Badge value={loan.status} />
                  </td>
                  <td className="px-4 py-3.5 text-center text-gray-400 text-xs">
                    {formatDate(loan.createdAt)}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {loan.status === 'PENDING_REVIEW' && (
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => setApproveModal(loan)} title="Phê duyệt"
                          className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors">
                          <Check size={15} />
                        </button>
                        <button onClick={() => setRejectModal(loan)} title="Từ chối"
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors">
                          <X size={15} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {data?.content.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">
                  Không có khoản gọi vốn nào
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
            <span>Tổng {data.totalElements} khoản gọi vốn</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40">
                <ChevronLeft size={16} />
              </button>
              <span className="px-2">Trang {page + 1} / {data.totalPages}</span>
              <button onClick={() => setPage(p => Math.min(data.totalPages - 1, p + 1))}
                disabled={page >= data.totalPages - 1}
                className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {approveModal && (
        <ApproveModal loan={approveModal}
          onConfirm={(rate, notes) => { setApproveModal(null); doAction(approveLoan(approveModal.loanId, rate, notes)); }}
          onCancel={() => setApproveModal(null)} />
      )}
      {rejectModal && (
        <RejectModal loan={rejectModal}
          onConfirm={reason => { setRejectModal(null); doAction(rejectLoan(rejectModal.loanId, reason)); }}
          onCancel={() => setRejectModal(null)} />
      )}
    </div>
  );
}
