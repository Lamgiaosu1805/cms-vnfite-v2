import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CalendarCheck, CheckCircle2, Clock, Info, RefreshCw, XCircle } from 'lucide-react';
import { fetchDueTodaySchedules, type DueTodayScheduleItem } from '../api/client';
import { formatVietnamDate, formatVietnamDateTime, todayVietnamDateString } from '../utils/dateTime';

function formatVND(v: number | undefined | null): string {
  if (v === undefined || v === null) return '—';
  return v.toLocaleString('vi-VN') + ' ₫';
}

// Giữ tên ngắn gọn cho các chỗ dùng trong file — ủy quyền toàn bộ cho formatter dùng chung.
const todayVNIso = todayVietnamDateString;
const isoToVN = (iso: string) => formatVietnamDate(iso);

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

interface LoanGroup {
  loanId: string;
  loanCode: string | undefined;
  borrowerFullName: string;
  borrowerPhone: string;
  periods: number[];         // danh sách số kỳ
  minDueDate: string;        // ngày đến hạn sớm nhất
  totalDue: number;          // sum(totalDue + lateFee) các kỳ
  principalDue: number;
  interestDue: number;
  lateFee: number;
  paidAmount: number;
  lateFeePaid: number;
  remaining: number;
  totalDebt: number;         // giống nhau cho mọi kỳ — lấy từ kỳ đầu
  worstDpd: number;
  worstStatus: string;       // PAID < UNPAID < PARTIAL < OVERDUE
}

function groupByLoan(items: DueTodayScheduleItem[]): LoanGroup[] {
  const map = new Map<string, LoanGroup>();
  for (const r of items) {
    const existing = map.get(r.loanId);
    if (!existing) {
      map.set(r.loanId, {
        loanId: r.loanId,
        loanCode: r.loanCode,
        borrowerFullName: r.borrowerFullName,
        borrowerPhone: r.borrowerPhone,
        periods: [r.periodNumber],
        minDueDate: r.dueDate,
        totalDue: r.totalDue + r.lateFee,
        principalDue: r.principalDue,
        interestDue: r.interestDue,
        lateFee: r.lateFee,
        paidAmount: r.paidAmount,
        lateFeePaid: r.lateFeePaid,
        remaining: r.remaining,
        totalDebt: r.totalDebt ?? r.remaining,
        worstDpd: r.dpd,
        worstStatus: r.status,
      });
    } else {
      existing.periods.push(r.periodNumber);
      if (r.dueDate < existing.minDueDate) existing.minDueDate = r.dueDate;
      existing.totalDue    += r.totalDue + r.lateFee;
      existing.principalDue+= r.principalDue;
      existing.interestDue += r.interestDue;
      existing.lateFee     += r.lateFee;
      existing.paidAmount  += r.paidAmount;
      existing.lateFeePaid += r.lateFeePaid;
      existing.remaining   += r.remaining;
      // totalDebt đã bao gồm tất cả kỳ — giữ giá trị lớn nhất (tất cả bằng nhau)
      existing.totalDebt = Math.max(existing.totalDebt, r.totalDebt ?? r.remaining);
      if (r.dpd > existing.worstDpd) existing.worstDpd = r.dpd;
      // Priority: OVERDUE > PARTIAL > UNPAID > PAID
      const rank: Record<string, number> = { PAID: 0, UNPAID: 1, PARTIAL: 2 };
      const getR = (s: string, dpd: number) => dpd > 0 ? 3 : (rank[s] ?? 1);
      if (getR(r.status, r.dpd) > getR(existing.worstStatus, existing.worstDpd)) {
        existing.worstStatus = r.status;
      }
    }
  }
  return Array.from(map.values());
}

function periodLabel(periods: number[]): string {
  if (periods.length === 1) return String(periods[0]);
  const sorted = [...periods].sort((a, b) => a - b);
  return `${sorted[0]}→${sorted[sorted.length - 1]}`;
}

export default function RepaymentDueTodayPage() {
  const [selectedDate, setSelectedDate] = useState<string>(todayVNIso());
  const [items, setItems]   = useState<DueTodayScheduleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  // Mốc thời điểm dữ liệu được tải — số tiền hiển thị luôn là số liệu HIỆN TẠI
  // (server cập nhật phí phạt/DPD lúc 01:00 sáng mỗi ngày), không phải snapshot
  // theo `selectedDate`. Bộ lọc ngày chỉ quyết định danh sách kỳ hiển thị.
  const [asOf, setAsOf] = useState<string>(() => new Date().toISOString());

  const load = useCallback(async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDueTodaySchedules(date);
      setItems(data ?? []);
      setAsOf(new Date().toISOString());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Không tải được dữ liệu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(selectedDate); }, [load, selectedDate]);

  const groups  = groupByLoan(items);
  const paid    = groups.filter(g => g.worstStatus === 'PAID' && g.worstDpd === 0);
  const unpaid  = groups.filter(g => !(g.worstStatus === 'PAID' && g.worstDpd === 0));
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
              Lọc kỳ đến hạn đến ngày {isoToVN(selectedDate)}
              {isToday && <span className="ml-1.5 text-xs font-semibold text-red-600 dark:text-red-400">(Hôm nay)</span>}
              {items.length > 0 && (
                <> · {groups.length} khoản ({items.length} kỳ) &nbsp;·&nbsp;
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">{paid.length} đã trả</span>
                  &nbsp;·&nbsp;
                  <span className="text-red-600 dark:text-red-400 font-medium">{unpaid.length} chưa trả</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Nút lùi/tiến ngày cắt của bộ lọc — KHÔNG xem lại số liệu lịch sử, chỉ đổi phạm vi kỳ hiển thị */}
          <button
            onClick={() => {
              const d = new Date(selectedDate + 'T00:00:00');
              d.setDate(d.getDate() - 1);
              setSelectedDate(new Intl.DateTimeFormat('sv-SE').format(d));
            }}
            title="Lùi ngày cắt của bộ lọc — số tiền hiển thị vẫn là số liệu hiện tại"
            className="px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700">
            − 1 ngày
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={e => e.target.value && setSelectedDate(e.target.value)}
            title="Đến hạn đến ngày (bộ lọc danh sách, không phải xem lại lịch sử)"
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-300 dark:focus:ring-red-700"
          />
          <button
            onClick={() => {
              const d = new Date(selectedDate + 'T00:00:00');
              d.setDate(d.getDate() + 1);
              setSelectedDate(new Intl.DateTimeFormat('sv-SE').format(d));
            }}
            title="Tiến ngày cắt của bộ lọc — số tiền hiển thị vẫn là số liệu hiện tại"
            className="px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700">
            + 1 ngày
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

      {/* Banner giải thích: tránh hiểu nhầm số tiền thay đổi theo ngày được chọn */}
      <div className="flex items-start gap-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-2.5 text-xs text-blue-800 dark:text-blue-300">
        <Info size={15} className="shrink-0 mt-0.5" />
        <span>
          Ô chọn ngày chỉ lọc <b>danh sách kỳ có hạn đến ngày đó</b> — các số tiền (phí phạt, còn lại, tổng nợ)
          luôn là <b>số liệu hiện tại</b>, được hệ thống cập nhật tự động lúc 01:00 sáng mỗi ngày, không phải số liệu
          tại thời điểm ngày đã chọn. Số liệu tính đến: <b>{formatVietnamDateTime(asOf)}</b>.
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
            {!loading && groups.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-gray-400 dark:text-gray-500">
                  Không có kỳ trả nợ nào đến hạn ngày {isoToVN(selectedDate)}
                </td>
              </tr>
            )}
            {!loading && groups.map(g => (
              <tr
                key={g.loanId}
                className={`transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30 ${g.worstStatus === 'PAID' && g.worstDpd === 0 ? 'opacity-60' : ''}`}>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <div className="font-semibold text-gray-900 dark:text-gray-100 text-xs">{g.loanCode || '—'}</div>
                  <div className="text-[11px] font-mono text-gray-400 dark:text-gray-500 truncate max-w-[90px]" title={g.loanId}>
                    {g.loanId?.slice(0, 8)}…
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="font-medium text-gray-900 dark:text-gray-100 text-xs">
                    {g.borrowerFullName || <span className="text-gray-400 dark:text-gray-500 italic">Chưa KYC</span>}
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">{g.borrowerPhone || '—'}</div>
                </td>
                <td className="px-3 py-2.5 text-center text-gray-700 dark:text-gray-300 font-medium">
                  <div className="font-bold">
                    {g.periods.length > 1
                      ? <span title={`Kỳ ${[...g.periods].sort((a,b)=>a-b).join(', ')}`}>{periodLabel(g.periods)}</span>
                      : g.periods[0]}
                  </div>
                  <div className="text-[11px] text-gray-400 dark:text-gray-500">{isoToVN(g.minDueDate)}</div>
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                  {formatVND(g.totalDue)}
                </td>
                <td className="px-3 py-2.5 text-right text-blue-700 dark:text-blue-300 whitespace-nowrap">{formatVND(g.principalDue)}</td>
                <td className="px-3 py-2.5 text-right text-green-700 dark:text-green-300 whitespace-nowrap">{formatVND(g.interestDue)}</td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  <span className={g.lateFee > 0 ? 'font-semibold text-yellow-700 dark:text-yellow-300' : 'text-gray-400 dark:text-gray-500'}>
                    {g.lateFee > 0 ? formatVND(g.lateFee) : '—'}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                  {(g.paidAmount + g.lateFeePaid) > 0 ? formatVND(g.paidAmount + g.lateFeePaid) : '—'}
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  {g.remaining > 0
                    ? <span className="font-semibold text-orange-700 dark:text-orange-300">{formatVND(g.remaining)}</span>
                    : <span className="text-gray-400 dark:text-gray-500">—</span>}
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap bg-red-50/40 dark:bg-red-900/10">
                  {g.totalDebt > 0
                    ? <span className="font-bold text-red-700 dark:text-red-300">{formatVND(g.totalDebt)}</span>
                    : <span className="text-gray-400 dark:text-gray-500">—</span>}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <StatusBadge status={g.worstStatus} dpd={g.worstDpd} />
                </td>
              </tr>
            ))}
          </tbody>
          {groups.length > 0 && !loading && (
            <tfoot>
              <tr className="border-t-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50">
                <td colSpan={3} className="px-3 py-2.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Tổng ({groups.length} khoản · {items.length} kỳ)
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
