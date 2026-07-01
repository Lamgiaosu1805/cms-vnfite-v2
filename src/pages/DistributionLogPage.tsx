import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, Receipt, RefreshCw, Search, X } from 'lucide-react';
import { fetchDistributionLog, type InvestorDistributionRecord } from '../api/client';
import { formatVietnamDateTime } from '../utils/dateTime';

function formatVND(value: number | undefined | null): string {
  if (value === undefined || value === null) return '—';
  return value.toLocaleString('vi-VN') + ' ₫';
}

function pct(rate: number | undefined | null): string {
  if (rate === undefined || rate === null) return '—';
  return (rate * 100).toFixed(1) + '%';
}

function investorDisplayName(record: InvestorDistributionRecord): string {
  return record.investorName?.trim() || record.investorPhone?.trim() || 'Chưa xác định';
}

export default function DistributionLogPage() {
  const [records, setRecords] = useState<InvestorDistributionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const [loanIdInput, setLoanIdInput]       = useState('');
  const [investorIdInput, setInvestorIdInput] = useState('');
  const [loanId, setLoanId]               = useState('');
  const [investorId, setInvestorId]       = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (p: number, ln: string, iv: string) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDistributionLog(ln || undefined, iv || undefined, p, PAGE_SIZE);
      setRecords(data.content ?? []);
      setTotal(data.totalElements ?? 0);
      setTotalPages(data.totalPages ?? 0);
    } catch (e: unknown) {
      if ((e as Error).name === 'CanceledError') return;
      setError(e instanceof Error ? e.message : 'Không tải được dữ liệu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page, loanId, investorId); }, [load, page, loanId, investorId]);

  const search = () => {
    setPage(0);
    setLoanId(loanIdInput.trim());
    setInvestorId(investorIdInput.trim());
  };

  const reset = () => {
    setLoanIdInput('');
    setInvestorIdInput('');
    setPage(0);
    setLoanId('');
    setInvestorId('');
  };

  const isFiltered = loanId || investorId;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Receipt size={22} className="text-red-700 dark:text-red-400" />
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Phân bổ & Thuế TNCN</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Chi tiết gốc / lãi / phí phạt / thuế TNCN 5% / thực nhận của từng nhà đầu tư mỗi lần trả nợ
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Mã khoản gọi vốn (loanId)</label>
          <input
            value={loanIdInput}
            onChange={e => setLoanIdInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="UUID hoặc bỏ trống"
            className="w-72 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-300 dark:focus:ring-red-700"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Nhà đầu tư (investorId)</label>
          <input
            value={investorIdInput}
            onChange={e => setInvestorIdInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="UUID hoặc bỏ trống"
            className="w-72 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-300 dark:focus:ring-red-700"
          />
        </div>
        <button
          onClick={search}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, #C82020, #8B0A0A)' }}>
          <Search size={15} />Tìm kiếm
        </button>
        {isFiltered && (
          <button onClick={reset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700">
            <X size={15} />Xóa lọc
          </button>
        )}
        <button
          onClick={() => load(page, loanId, investorId)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Làm mới
        </button>
        <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
          {total > 0 && `${total.toLocaleString('vi-VN')} bản ghi`}
        </span>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <AlertCircle size={16} />{error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">Thời gian</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">Khoản</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Nhà đầu tư</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Tổng trả</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase">Gốc</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-green-600 dark:text-green-400 uppercase">Lãi</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-yellow-600 dark:text-yellow-400 uppercase">Phí phạt</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-red-600 dark:text-red-400 uppercase whitespace-nowrap">Thuế TNCN</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase">Thực nhận</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-gray-400 dark:text-gray-500">
                  <RefreshCw size={20} className="animate-spin mx-auto mb-2" />Đang tải...
                </td>
              </tr>
            )}
            {!loading && records.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-gray-400 dark:text-gray-500">
                  {isFiltered ? 'Không tìm thấy kết quả phù hợp' : 'Chưa có dữ liệu phân bổ'}
                </td>
              </tr>
            )}
            {records.map(r => (
              <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <td className="px-3 py-2.5 whitespace-nowrap text-gray-600 dark:text-gray-400 text-xs">
                  {formatVietnamDateTime(r.distributedAt)}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <div className="font-medium text-gray-900 dark:text-gray-100 text-xs">{r.loanCode || '—'}</div>
                  <div className="text-gray-400 dark:text-gray-500 text-[11px] font-mono truncate max-w-[120px]" title={r.loanId}>{r.loanId.slice(0, 8)}…</div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[180px]" title={investorDisplayName(r)}>
                    {investorDisplayName(r)}
                  </div>
                  {r.investorPhone && (
                    <div className="text-[11px] font-mono text-gray-500 dark:text-gray-400">{r.investorPhone}</div>
                  )}
                  <div className="text-[11px] font-mono text-gray-400 dark:text-gray-500 truncate max-w-[140px]" title={r.investorId}>{r.investorId.slice(0, 8)}…</div>
                </td>
                <td className="px-3 py-2.5 text-right text-gray-900 dark:text-gray-100 font-medium whitespace-nowrap">
                  {formatVND(r.grossAmount)}
                </td>
                <td className="px-3 py-2.5 text-right text-blue-700 dark:text-blue-300 whitespace-nowrap">
                  {formatVND(r.principalAmount)}
                </td>
                <td className="px-3 py-2.5 text-right text-green-700 dark:text-green-300 whitespace-nowrap">
                  {formatVND(r.interestAmount)}
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  <span className={r.lateFeeAmount > 0 ? 'text-yellow-700 dark:text-yellow-300' : 'text-gray-400 dark:text-gray-500'}>
                    {r.lateFeeAmount > 0 ? formatVND(r.lateFeeAmount) : '—'}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  {r.taxAmount > 0 ? (
                    <div>
                      <div className="text-red-700 dark:text-red-300 font-medium">{formatVND(r.taxAmount)}</div>
                      <div className="text-[11px] text-red-400 dark:text-red-500">{pct(r.taxRate)}</div>
                    </div>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">{formatVND(r.netAmount)}</span>
                </td>
              </tr>
            ))}
          </tbody>
          {/* Totals row */}
          {records.length > 0 && !loading && (
            <tfoot>
              <tr className="border-t-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50">
                <td colSpan={3} className="px-3 py-2.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Trang này ({records.length} dòng)
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-gray-900 dark:text-gray-100 text-sm whitespace-nowrap">
                  {formatVND(records.reduce((s, r) => s + r.grossAmount, 0))}
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-blue-700 dark:text-blue-300 text-sm whitespace-nowrap">
                  {formatVND(records.reduce((s, r) => s + r.principalAmount, 0))}
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-green-700 dark:text-green-300 text-sm whitespace-nowrap">
                  {formatVND(records.reduce((s, r) => s + r.interestAmount, 0))}
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-yellow-700 dark:text-yellow-300 text-sm whitespace-nowrap">
                  {formatVND(records.reduce((s, r) => s + r.lateFeeAmount, 0))}
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-red-700 dark:text-red-300 text-sm whitespace-nowrap">
                  {formatVND(records.reduce((s, r) => s + r.taxAmount, 0))}
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-emerald-700 dark:text-emerald-300 text-sm whitespace-nowrap">
                  {formatVND(records.reduce((s, r) => s + r.netAmount, 0))}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Trang {page + 1} / {totalPages} &nbsp;·&nbsp; {total.toLocaleString('vi-VN')} bản ghi
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40">
              <ChevronLeft size={16} />Trước
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || loading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40">
              Sau<ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
