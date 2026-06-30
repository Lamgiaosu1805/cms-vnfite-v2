import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CalendarCheck, CheckCircle2, Clock, RefreshCw, XCircle } from 'lucide-react';
import { fetchDueTodaySchedules, type DueTodayScheduleItem } from '../api/client';

function formatVND(v: number | undefined | null): string {
  if (v === undefined || v === null) return '—';
  return v.toLocaleString('vi-VN') + ' ₫';
}

function todayVNIso(): string {
  const now = new Date();
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now);
}

function isoToVN(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function StatusBadge({ status, dpd }: { status: string; dpd: number }) {
  if (status === 'PAID') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 size={12} />Đã trả
      </span>
    );
  }
  if (dpd > 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
        <XCircle size={12} />Quá hạn {dpd}N
      </span>
    );
  }
  if (status === 'PARTIAL') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
        <Clock size={12} />Trả 1 phần
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
      <Clock size={12} />Chưa trả
    </span>
  );
}

export default function RepaymentDueTodayPage() {
  const [selectedDate, setSelectedDate] = useState<string>(todayVNIso());
  const [items, setItems]   = useState<DueTodayScheduleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const load = useCallback(async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDueTodaySchedules(date);
      setItems(data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Không tải được dữ liệu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(selectedDate); }, [load, selectedDate]);

  const paid   = items.filter(i => i.status === 'PAID');
  const unpaid = items.filter(i => i.status !== 'PAID');
  const isToday = selectedDate === todayVNIso();

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <CalendarCheck size={22} className="text-red-700 dark:text-red-400" />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Theo dõi trả nợ</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isoToVN(selectedDate)}
              {isToday && <span className="ml-1.5 text-xs font-semibold text-red-600 dark:text-red-400">(Hôm nay)</span>}
              {items.length > 0 && (
                <> · {items.length} kỳ &nbsp;·&nbsp;
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">{paid.length} đã trả</span>
                  &nbsp;·&nbsp;
                  <span className="text-red-600 dark:text-red-400 font-medium">{unpaid.length} chưa trả</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Nút ngày hôm qua / hôm nay / ngày mai */}
          <button
            onClick={() => {
              const d = new Date(selectedDate + 'T00:00:00');
              d.setDate(d.getDate() - 1);
              setSelectedDate(new Intl.DateTimeFormat('sv-SE').format(d));
            }}
            className="px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700">
            ← Hôm qua
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={e => e.target.value && setSelectedDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-300 dark:focus:ring-red-700"
          />
          <button
            onClick={() => {
              const d = new Date(selectedDate + 'T00:00:00');
              d.setDate(d.getDate() + 1);
              setSelectedDate(new Intl.DateTimeFormat('sv-SE').format(d));
            }}
            className="px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700">
            Ngày mai →
          </button>
          {!isToday && (
            <button
              onClick={() => setSelectedDate(todayVNIso())}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #C82020, #8B0A0A)' }}>
              Hôm nay
            </button>
          )}
          <button
            onClick={() => load(selectedDate)}
            disabled={loading}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
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
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">Khoản</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Người gọi vốn</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Kỳ / Ngày ĐH</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase whitespace-nowrap">Kỳ này phải trả</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase">Gốc</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-green-600 dark:text-green-400 uppercase">Lãi</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-yellow-600 dark:text-yellow-400 uppercase">Phí phạt</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase">Đã trả</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase whitespace-nowrap">Còn lại kỳ này</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-red-700 dark:text-red-400 uppercase whitespace-nowrap bg-red-50 dark:bg-red-900/20">Tổng nợ cần trả</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading && (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-gray-400 dark:text-gray-500">
                  <RefreshCw size={20} className="animate-spin mx-auto mb-2" />Đang tải...
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-gray-400 dark:text-gray-500">
                  Không có kỳ trả nợ nào đến hạn ngày {isoToVN(selectedDate)}
                </td>
              </tr>
            )}
            {!loading && items.map(r => (
              <tr
                key={r.scheduleId}
                className={`transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30 ${r.status === 'PAID' ? 'opacity-60' : ''}`}>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <div className="font-semibold text-gray-900 dark:text-gray-100 text-xs">{r.loanCode || '—'}</div>
                  <div className="text-[11px] font-mono text-gray-400 dark:text-gray-500 truncate max-w-[90px]" title={r.loanId}>
                    {r.loanId?.slice(0, 8)}…
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="font-medium text-gray-900 dark:text-gray-100 text-xs">
                    {r.borrowerFullName || <span className="text-gray-400 dark:text-gray-500 italic">Chưa KYC</span>}
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">{r.borrowerPhone || '—'}</div>
                </td>
                <td className="px-3 py-2.5 text-center text-gray-700 dark:text-gray-300 font-medium">
                  <div className="font-bold">{r.periodNumber}</div>
                  <div className="text-[11px] text-gray-400 dark:text-gray-500">{isoToVN(r.dueDate)}</div>
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                  {formatVND(r.totalDue + r.lateFee)}
                </td>
                <td className="px-3 py-2.5 text-right text-blue-700 dark:text-blue-300 whitespace-nowrap">{formatVND(r.principalDue)}</td>
                <td className="px-3 py-2.5 text-right text-green-700 dark:text-green-300 whitespace-nowrap">{formatVND(r.interestDue)}</td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  <span className={r.lateFee > 0 ? 'font-semibold text-yellow-700 dark:text-yellow-300' : 'text-gray-400 dark:text-gray-500'}>
                    {r.lateFee > 0 ? formatVND(r.lateFee) : '—'}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                  {(r.paidAmount + r.lateFeePaid) > 0 ? formatVND(r.paidAmount + r.lateFeePaid) : '—'}
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  {r.remaining > 0
                    ? <span className="font-semibold text-orange-700 dark:text-orange-300">{formatVND(r.remaining)}</span>
                    : <span className="text-gray-400 dark:text-gray-500">—</span>}
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap bg-red-50/40 dark:bg-red-900/10">
                  {(r.totalDebt ?? r.remaining) > 0
                    ? <span className="font-bold text-red-700 dark:text-red-300">{formatVND(r.totalDebt ?? r.remaining)}</span>
                    : <span className="text-gray-400 dark:text-gray-500">—</span>}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <StatusBadge status={r.status} dpd={r.dpd} />
                </td>
              </tr>
            ))}
          </tbody>
          {items.length > 0 && !loading && (
            <tfoot>
              <tr className="border-t-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50">
                <td colSpan={3} className="px-3 py-2.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Tổng ({items.length} kỳ)
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-gray-900 dark:text-gray-100 text-sm whitespace-nowrap">
                  {formatVND(items.reduce((s, r) => s + r.totalDue + r.lateFee, 0))}
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-blue-700 dark:text-blue-300 text-sm whitespace-nowrap">
                  {formatVND(items.reduce((s, r) => s + r.principalDue, 0))}
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-green-700 dark:text-green-300 text-sm whitespace-nowrap">
                  {formatVND(items.reduce((s, r) => s + r.interestDue, 0))}
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-yellow-700 dark:text-yellow-300 text-sm whitespace-nowrap">
                  {formatVND(items.reduce((s, r) => s + r.lateFee, 0))}
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-emerald-700 dark:text-emerald-300 text-sm whitespace-nowrap">
                  {formatVND(items.reduce((s, r) => s + r.paidAmount + r.lateFeePaid, 0))}
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-orange-700 dark:text-orange-300 text-sm whitespace-nowrap">
                  {formatVND(items.reduce((s, r) => s + r.remaining, 0))}
                </td>
                <td className="px-3 py-2.5 text-right font-bold text-red-700 dark:text-red-300 text-sm whitespace-nowrap bg-red-50/40 dark:bg-red-900/10">
                  {formatVND(items.reduce((s, r) => s + (r.totalDebt ?? r.remaining), 0))}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
