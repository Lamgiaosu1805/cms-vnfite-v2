import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, Receipt, RefreshCw } from 'lucide-react';
import { fetchFeeRevenueReport, type FeeRevenueItem } from '../api/client';
import { formatVietnamDateTime } from '../utils/dateTime';

function formatVND(value: number | undefined | null): string {
  if (value === undefined || value === null) return '—';
  return Math.round(value).toLocaleString('vi-VN') + ' ₫';
}

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white" style={{ background: color }}>
          <Receipt size={15} />
        </span>
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <div className="text-lg font-bold text-gray-900 dark:text-white">{value}</div>
      {sub && <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function FeeRevenuePage() {
  const [items, setItems]           = useState<FeeRevenueItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalFee, setTotalFee]     = useState(0);
  const [totalAppraisal, setTotalAppraisal] = useState(0);
  const [totalVat, setTotalVat]     = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage]             = useState(0);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const PAGE_SIZE = 50;

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchFeeRevenueReport(p, PAGE_SIZE);
      setItems(data.items ?? []);
      setTotalCount(data.totalCount ?? 0);
      setTotalFee(data.totalFeeRevenue ?? 0);
      setTotalAppraisal(data.totalAppraisalFee ?? 0);
      setTotalVat(data.totalVat ?? 0);
      setTotalPages(data.totalPages ?? 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Không tải được dữ liệu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page); }, [load, page]);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Receipt size={22} className="text-red-700 dark:text-red-400" />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Doanh thu phí</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Sổ cái phí thẩm định + VAT thu được từ các khoản đã giải ngân ({totalCount.toLocaleString('vi-VN')} khoản)
            </p>
          </div>
        </div>
        <button
          onClick={() => load(page)} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />Làm mới
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard label="Tổng doanh thu phí" value={formatVND(totalFee)}
          sub="Phí thẩm định + VAT" color="linear-gradient(135deg,#0F766E,#14B8A6)" />
        <SummaryCard label="Phí thẩm định" value={formatVND(totalAppraisal)}
          sub="Chưa gồm VAT" color="linear-gradient(135deg,#0E7490,#06B6D4)" />
        <SummaryCard label="VAT đã thu (10%)" value={formatVND(totalVat)}
          sub="Thuế GTGT trên phí thẩm định" color="linear-gradient(135deg,#1D4ED8,#3B82F6)" />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <AlertCircle size={16} />{error}
        </div>
      )}

      {/* Note */}
      <p className="text-[11px] text-gray-400 dark:text-gray-500 italic">
        Tiền phí thực tế đọng trong tài khoản tổng VNFITE tại MB; bảng này hạch toán để đối soát, không di chuyển dòng tiền.
      </p>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">Ngày giải ngân</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Khoản</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Số tiền khoản</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Tỷ lệ phí</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-cyan-600 dark:text-cyan-400 uppercase">Phí thẩm định</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase">VAT (10%)</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase">Tổng phí</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400 dark:text-gray-500">
                  <RefreshCw size={20} className="animate-spin mx-auto mb-2" />Đang tải...
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400 dark:text-gray-500">
                  Chưa có khoản nào được giải ngân
                </td>
              </tr>
            )}
            {items.map(r => (
              <tr key={r.loanId} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <td className="px-3 py-2.5 whitespace-nowrap text-gray-600 dark:text-gray-400 text-xs">
                  {r.disbursedAt ? formatVietnamDateTime(r.disbursedAt) : '—'}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <div className="font-medium text-gray-900 dark:text-gray-100 text-xs">{r.loanCode || '—'}</div>
                  <div className="text-gray-400 dark:text-gray-500 text-[11px] font-mono truncate max-w-[120px]" title={r.loanId}>{r.loanId.slice(0, 8)}…</div>
                </td>
                <td className="px-3 py-2.5 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">{formatVND(r.loanAmount)}</td>
                <td className="px-3 py-2.5 text-center text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {r.appraisalFeeRate != null ? `${r.appraisalFeeRate}%` : '—'}
                </td>
                <td className="px-3 py-2.5 text-right text-cyan-700 dark:text-cyan-300 whitespace-nowrap">{formatVND(r.appraisalFee)}</td>
                <td className="px-3 py-2.5 text-right text-blue-700 dark:text-blue-300 whitespace-nowrap">{formatVND(r.vatAmount)}</td>
                <td className="px-3 py-2.5 text-right font-semibold text-teal-700 dark:text-teal-300 whitespace-nowrap">{formatVND(r.totalFee)}</td>
              </tr>
            ))}
          </tbody>
          {items.length > 0 && !loading && (
            <tfoot>
              <tr className="border-t-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50">
                <td colSpan={4} className="px-3 py-2.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Trang này ({items.length} khoản)
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-cyan-700 dark:text-cyan-300 text-sm whitespace-nowrap">
                  {formatVND(items.reduce((s, r) => s + r.appraisalFee, 0))}
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-blue-700 dark:text-blue-300 text-sm whitespace-nowrap">
                  {formatVND(items.reduce((s, r) => s + r.vatAmount, 0))}
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-teal-700 dark:text-teal-300 text-sm whitespace-nowrap">
                  {formatVND(items.reduce((s, r) => s + r.totalFee, 0))}
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
            Trang {page + 1} / {totalPages} &nbsp;·&nbsp; {totalCount.toLocaleString('vi-VN')} khoản
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
