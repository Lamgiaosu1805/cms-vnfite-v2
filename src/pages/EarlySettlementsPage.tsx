import { useEffect, useState } from 'react';
import { fetchEarlySettlements, type EarlySettlementRecord } from '../api/client';
import { Loader2, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatVietnamDateTime } from '../utils/dateTime';

function formatVND(n: number): string {
  return n.toLocaleString('vi-VN') + ' đ';
}

export function EarlySettlementsPage() {
  const [records, setRecords] = useState<EarlySettlementRecord[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const PAGE_SIZE = 20;

  useEffect(() => {
    setLoading(true);
    fetchEarlySettlements(page, PAGE_SIZE)
      .then(data => {
        setRecords(data.content);
        setTotalElements(data.totalElements);
        setTotalPages(data.totalPages);
        setError(null);
      })
      .catch(err => setError(err?.message ?? 'Không thể tải dữ liệu'))
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Sổ tất toán trước hạn</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {totalElements > 0 ? `${totalElements} khoản đã tất toán sớm` : 'Chưa có khoản nào'}
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-sm font-medium">
          <CheckCircle size={14} />
          Doanh thu phí về VNFITE
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-48 text-gray-500 dark:text-gray-400">
          <Loader2 size={24} className="animate-spin mr-2" />
          Đang tải…
        </div>
      )}

      {/* Table */}
      {!loading && records.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Mã khoản</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ngày tất toán</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Gốc tất toán</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Lãi tới ngày</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Phí phạt</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Phí tất toán</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tổng thu</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tỷ lệ phí</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Người thực hiện</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {records.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-gray-900 dark:text-gray-100">
                      {r.loanCode}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {formatVietnamDateTime(r.settledAt)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100 tabular-nums">
                      {formatVND(r.principalSettled)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300 tabular-nums">
                      {formatVND(r.interestToDate)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.penaltyPaid > 0
                        ? <span className="text-orange-600 dark:text-orange-400">{formatVND(r.penaltyPaid)}</span>
                        : <span className="text-gray-400">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className="font-semibold text-green-700 dark:text-green-400">
                        {formatVND(r.settlementFee)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className="font-bold text-gray-900 dark:text-gray-100">
                        {formatVND(r.totalPaid)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {r.settlementFeeRate}%
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs truncate max-w-[120px]">
                      {r.settledBy}
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Tổng hàng footer */}
              {records.length > 1 && (
                <tfoot>
                  <tr className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                    <td className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-xs" colSpan={2}>
                      Tổng trang này ({records.length} khoản)
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100 tabular-nums text-xs">
                      {formatVND(records.reduce((s, r) => s + r.principalSettled, 0))}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300 tabular-nums text-xs">
                      {formatVND(records.reduce((s, r) => s + r.interestToDate, 0))}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-orange-600 dark:text-orange-400 tabular-nums text-xs">
                      {formatVND(records.reduce((s, r) => s + r.penaltyPaid, 0))}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-green-700 dark:text-green-400 tabular-nums text-xs">
                      {formatVND(records.reduce((s, r) => s + r.settlementFee, 0))}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-gray-100 tabular-nums text-xs">
                      {formatVND(records.reduce((s, r) => s + r.totalPaid, 0))}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Empty */}
      {!loading && records.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400 dark:text-gray-500 space-y-2">
          <CheckCircle size={40} className="opacity-30" />
          <p className="text-sm">Chưa có khoản tất toán sớm nào</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Trang {page + 1} / {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
              Trước
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Sau
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
