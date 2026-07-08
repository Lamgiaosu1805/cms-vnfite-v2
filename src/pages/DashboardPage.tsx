import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, BarChart3, Bell, CalendarClock, CircleDollarSign, RefreshCw,
  Send, Smartphone, TrendingUp, Users, WalletCards, Receipt,
} from 'lucide-react';
import {
  fetchChart, fetchStats, getFcmDeviceCount, sendTestPush,
  getStoredAdmin, adminHasAnyRole, type ChartPeriod, type ChartPoint, type DashboardStats, type RepaymentAttentionItem,
} from '../api/client';

// ─── Dark-mode observer ───────────────────────────────────────────────────────

function useDarkMode() {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark'),
  );
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains('dark')),
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(value: number | string | undefined) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })
    .format(Number(value || 0));
}

function shortMoney(v: number) {
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + ' tỷ';
  if (v >= 1_000_000)     return (v / 1_000_000).toFixed(1) + ' triệu';
  if (v >= 1_000)         return (v / 1_000).toFixed(0) + ' nghìn';
  return v > 0 ? v.toString() : '';
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : '—';
}

// ─── Metric card ──────────────────────────────────────────────────────────────

function Metric({ label, value, icon, color, sub }: {
  label: string; value: string | number; icon: React.ReactNode; color: string; sub?: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</span>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: color }}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Period tabs ──────────────────────────────────────────────────────────────

const PERIODS: { key: ChartPeriod; label: string }[] = [
  { key: 'week',  label: 'Tuần' },
  { key: 'month', label: 'Tháng' },
  { key: 'year',  label: 'Năm' },
];

// ─── Debt monitoring ─────────────────────────────────────────────────────────

function DebtDonut({ stats }: { stats: DashboardStats }) {
  const total = Number(stats.totalOutstanding || 0);
  const principal = Number(stats.outstandingPrincipal || 0);
  const interest = Number(stats.outstandingInterest || 0);
  const lateFee = Number(stats.outstandingLateFee || 0);
  const principalPct = total > 0 ? (principal / total) * 100 : 0;
  const interestPct = total > 0 ? (interest / total) * 100 : 0;
  const donutBackground = total > 0
    ? `conic-gradient(#C82020 0 ${principalPct}%, #E8A030 ${principalPct}% ${principalPct + interestPct}%, #7C3AED ${principalPct + interestPct}% 100%)`
    : 'conic-gradient(#E5E7EB 0 100%)';

  const parts = [
    { label: 'Gốc còn lại', value: principal, color: '#C82020' },
    { label: 'Lãi còn lại', value: interest, color: '#E8A030' },
    { label: 'Phí phạt', value: lateFee, color: '#7C3AED' },
  ];

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-5">
        <h3 className="font-bold text-gray-900 dark:text-gray-100">Cơ cấu dư nợ</h3>
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Cập nhật đến {formatDate(stats.debtAsOfDate)}</p>
      </div>
      <div className="space-y-6">
        <div className="relative mx-auto h-44 w-44 shrink-0 rounded-full" style={{ background: donutBackground }}>
          <div className="absolute inset-6 flex flex-col items-center justify-center rounded-full bg-white text-center dark:bg-gray-800">
            <span className="text-xs text-gray-400 dark:text-gray-500">Tổng dư nợ</span>
            <strong className="mt-1 text-base text-gray-900 dark:text-gray-100">{shortMoney(total) || '0 đ'}</strong>
          </div>
        </div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
          {parts.map(part => (
            <div key={part.label} className="rounded-xl bg-gray-50 px-3 py-2.5 text-sm dark:bg-gray-900/40">
              <span className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: part.color }} />
                <span>{part.label}</span>
              </span>
              <strong className="mt-1 block break-words pl-4 text-gray-900 dark:text-gray-100">
                {formatMoney(part.value)}
              </strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RepaymentTable({ items }: { items: RepaymentAttentionItem[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 dark:border-gray-700">
        <div>
          <h3 className="font-bold text-gray-900 dark:text-gray-100">Khách hàng cần theo dõi</h3>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Ưu tiên khoản quá hạn, sau đó đến kỳ trong 7 ngày</p>
        </div>
        <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {items.length} kỳ
        </span>
      </div>
      <div className="max-h-[430px] overflow-auto">
        <table className="w-full min-w-[850px] text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400">
            <tr>
              <th className="px-4 py-3 text-left">Khách hàng</th>
              <th className="px-4 py-3 text-center">Mã khoản</th>
              <th className="px-4 py-3 text-center">Kỳ</th>
              <th className="px-4 py-3 text-center">Đến hạn</th>
              <th className="px-4 py-3 text-center">Trạng thái</th>
              <th className="px-4 py-3 text-right">Gốc + lãi</th>
              <th className="px-4 py-3 text-right">Phí phạt</th>
              <th className="px-4 py-3 text-right">Tổng phải thu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {items.map(item => (
              <tr key={`${item.loanId}-${item.periodNumber}`} className="hover:bg-gray-50/70 dark:hover:bg-gray-700/30">
                <td className="px-4 py-3">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{item.borrowerName || item.borrowerId}</p>
                  <p className="mt-0.5 font-mono text-xs text-gray-400 dark:text-gray-500">{item.borrowerPhone || 'Chưa có SĐT'}</p>
                </td>
                <td className="px-4 py-3 text-center font-mono font-semibold text-gray-700 dark:text-gray-200">{item.loanCode || item.loanId.slice(0, 8)}</td>
                <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">{item.periodNumber ?? '—'}</td>
                <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">{formatDate(item.dueDate)}</td>
                <td className="px-4 py-3 text-center">
                  {item.status === 'OVERDUE' ? (
                    <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">Quá hạn {item.dpd} ngày</span>
                  ) : (
                    <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Sắp đến hạn</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{formatMoney(item.principalOutstanding + item.interestOutstanding)}</td>
                <td className="px-4 py-3 text-right text-purple-700 dark:text-purple-300">{formatMoney(item.lateFeeOutstanding)}</td>
                <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-gray-100">{formatMoney(item.totalOutstanding)}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400 dark:text-gray-500">Không có kỳ thanh toán đến hạn hoặc quá hạn.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Bar chart ────────────────────────────────────────────────────────────────

type ChartMetricKey = 'loanVolume' | 'newUsers';

function SingleMetricBarChart({
  points,
  period,
  isDark,
  metric,
  title,
  subtitle,
  gradient,
  formatValue,
  formatTick,
}: {
  points: ChartPoint[];
  period: ChartPeriod;
  isDark: boolean;
  metric: ChartMetricKey;
  title: string;
  subtitle: string;
  gradient: string;
  formatValue: (value: number) => string;
  formatTick: (value: number) => string;
}) {
  const [tooltip, setTooltip] = useState<{ idx: number; x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const maxValue = Math.max(...points.map(p => Number(p[metric] || 0)), 1);
  const yTicks = [1, 0.75, 0.5, 0.25, 0].map(r => ({ pct: r, value: maxValue * r }));
  const gapX = period === 'month' ? 'gap-2' : 'gap-3';
  const active = tooltip ? points[tooltip.idx] : null;
  const dimColor = isDark ? '#374151' : '#E5E7EB';

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/30 p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100">{title}</h4>
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>
        </div>
        <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: gradient }} />
      </div>

      <div className="relative select-none" ref={containerRef}>
        {active && (
          <div
            className="absolute z-20 rounded-xl bg-gray-900 px-3 py-2 text-xs text-white shadow-lg pointer-events-none whitespace-nowrap dark:bg-gray-700"
            style={{ left: tooltip!.x, top: tooltip!.y - 8, transform: 'translate(-50%, -100%)' }}>
            <div className="mb-1 font-semibold">{active.label} {period === 'week' ? `(${active.date})` : ''}</div>
            <div className="flex flex-col gap-0.5">
              <span>{title}: {formatValue(Number(active[metric] || 0))}</span>
              {metric === 'loanVolume' && <span>Số khoản gọi vốn mới: {active.newLoans}</span>}
            </div>
            <div className="absolute left-1/2 bottom-[-5px] h-0 w-0 -translate-x-1/2"
              style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: `5px solid ${isDark ? '#374151' : '#111827'}` }} />
          </div>
        )}

        <div className="flex gap-4">
          <div className="flex shrink-0 flex-col justify-between pb-6 text-right text-xs text-gray-400 dark:text-gray-500" style={{ height: 170, width: 56 }}>
            {yTicks.map(t => (
              <span key={t.pct}>{formatTick(t.value)}</span>
            ))}
          </div>

          <div className="flex-1 overflow-x-auto">
            <div className={`flex ${gapX} items-end`} style={{ minWidth: 'max-content' }}>
              {points.map((p, i) => {
                const value = Number(p[metric] || 0);
                const barH = Math.max(3, (value / maxValue) * 145);
                const dim = p.future;
                const colW = period === 'month' ? 28 : period === 'year' ? 38 : 46;
                const barW = period === 'month' ? 18 : 24;

                return (
                  <div key={`${metric}-${p.date}-${i}`}
                    className="group flex shrink-0 cursor-pointer flex-col items-center"
                    style={{ width: colW }}
                    onMouseEnter={e => {
                      const rect = containerRef.current?.getBoundingClientRect();
                      const el = e.currentTarget.getBoundingClientRect();
                      if (rect) setTooltip({ idx: i, x: el.left + el.width / 2 - rect.left + 56, y: el.top - rect.top });
                    }}
                    onMouseLeave={() => setTooltip(null)}>
                    <div className="flex w-full items-end justify-center" style={{ height: 145 }}>
                      <div className="rounded-t-lg transition-all duration-200 group-hover:brightness-95"
                        style={{ height: barH, width: barW, background: dim ? dimColor : gradient }} />
                    </div>
                    <div className={`mt-1 w-full text-center font-medium ${dim ? 'text-gray-300 dark:text-gray-600' : 'text-gray-400 dark:text-gray-500'}`}
                      style={{ fontSize: period === 'month' ? 9 : 11 }}>
                      {p.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Test Push Panel ──────────────────────────────────────────────────────────

function TestPushPanel() {
  const [deviceCount, setDeviceCount]   = useState<number | null>(null);
  const [open, setOpen]                 = useState(false);
  const [title, setTitle]               = useState('Thông báo từ VNFITE');
  const [body, setBody]                 = useState('Đây là thông báo test từ hệ thống VNFITE.');
  const [sending, setSending]           = useState(false);
  const [result, setResult]             = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    getFcmDeviceCount()
      .then(r => setDeviceCount(r.count))
      .catch(() => setDeviceCount(null));
  }, []);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const res = await sendTestPush(title.trim(), body.trim());
      const msg = res.message
        ? res.message
        : `Đã gửi đến ${res.sentTo} thiết bị.`;
      setResult({ ok: true, msg });
      setDeviceCount(res.sentTo);
    } catch (e: unknown) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : 'Gửi thất bại.' });
    } finally {
      setSending(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    setResult(null);
    // Refresh device count mỗi lần mở
    getFcmDeviceCount()
      .then(r => setDeviceCount(r.count))
      .catch(() => {});
  };

  return (
    <>
      {/* Trigger card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
              style={{ background: 'linear-gradient(135deg,#C82020,#8B0A0A)' }}>
              <Bell size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Gửi thông báo test</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-1">
                <Smartphone size={11} />
                {deviceCount === null
                  ? 'Đang tải...'
                  : deviceCount === 0
                    ? 'Chưa có thiết bị đăng ký'
                    : `${deviceCount} thiết bị đang đăng ký`}
              </p>
            </div>
          </div>
          <button
            onClick={handleOpen}
            disabled={deviceCount === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg,#C82020,#8B0A0A)' }}>
            <Send size={14} /> Gửi test
          </button>
        </div>
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={e => { if (e.target === e.currentTarget) { setOpen(false); setResult(null); } }}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell size={18} style={{ color: '#C82020' }} />
                <h3 className="font-bold text-gray-900 dark:text-gray-100">Gửi thông báo test</h3>
              </div>
              <button onClick={() => { setOpen(false); setResult(null); }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none">✕</button>
            </div>

            {/* Device count badge */}
            <div className="flex items-center gap-2 text-xs bg-gray-50 dark:bg-gray-700/50 rounded-xl px-3 py-2 text-gray-500 dark:text-gray-400">
              <Smartphone size={12} />
              {deviceCount === null ? 'Đang tải...' : deviceCount === 0
                ? 'Chưa có thiết bị nào đang đăng ký FCM token'
                : `Sẽ gửi đến ${deviceCount} thiết bị đang đăng ký`}
            </div>

            {/* Form */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Tiêu đề</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  maxLength={100}
                  placeholder="Tiêu đề thông báo..."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': '#C82020' } as React.CSSProperties} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nội dung</label>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Nội dung thông báo..."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 resize-none"
                  style={{ '--tw-ring-color': '#C82020' } as React.CSSProperties} />
              </div>
            </div>

            {/* Result banner */}
            {result && (
              <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
                result.ok
                  ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-100 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800'
              }`}>
                {result.ok ? '✅ ' : '❌ '}{result.msg}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button onClick={() => { setOpen(false); setResult(null); }}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                Đóng
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !title.trim() || !body.trim() || deviceCount === 0}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg,#C82020,#8B0A0A)' }}>
                {sending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                {sending ? 'Đang gửi...' : 'Gửi ngay'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const isDark = useDarkMode();
  const admin = getStoredAdmin();
  const canSendTestPush = adminHasAnyRole(admin, 'SUPER_ADMIN', 'ADMIN', 'CONTENT');
  const [stats, setStats]               = useState<DashboardStats | null>(null);
  const [chart, setChart]               = useState<ChartPoint[]>([]);
  const [period, setPeriod]             = useState<ChartPeriod>('week');
  const [chartLoading, setChartLoading] = useState(false);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');

  const loadStats = () => {
    setLoading(true);
    setError('');
    fetchStats()
      .then(s => setStats(s))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const loadChart = (p: ChartPeriod) => {
    setChartLoading(true);
    fetchChart(p)
      .then(c => setChart(c.points || []))
      .catch(() => setChart([]))
      .finally(() => setChartLoading(false));
  };

  useEffect(() => { loadStats(); loadChart('week'); }, []);

  const handlePeriod = (p: ChartPeriod) => {
    if (p === period) return;
    setPeriod(p);
    loadChart(p);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">
      <RefreshCw size={20} className="animate-spin mr-2" style={{ color: '#C82020' }} /> Đang tải...
    </div>
  );

  if (error) return (
    <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl p-6 text-sm border border-red-100 dark:border-red-800">
      {error} <button onClick={loadStats} className="underline ml-2">Thử lại</button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Metric label="Tổng khách hàng" value={stats?.totalUsers ?? 0}
          sub={`+${stats?.todayNewUsers ?? 0} hôm nay`}
          icon={<Users size={16} />} color="linear-gradient(135deg,#C82020,#8B0A0A)" />
        <Metric label="Đang gọi vốn" value={stats?.activeLoans ?? 0}
          sub={shortMoney(stats?.activeFundingVolume ?? 0)}
          icon={<TrendingUp size={16} />} color="linear-gradient(135deg,#E8A030,#C47820)" />
        <Metric label="Tổng khoản gọi vốn" value={stats?.totalLoans ?? 0}
          sub={`${stats?.pendingLoans ?? 0} chờ duyệt · ${stats?.activeLoans ?? 0} active`}
          icon={<CircleDollarSign size={16} />} color="linear-gradient(135deg,#C82020,#E84A20)" />
        <Metric label="Tổng đã được đầu tư" value={shortMoney(stats?.totalFundedVolume ?? 0)}
          sub={`+${shortMoney(stats?.todayLoanVolume ?? 0)} hôm nay`}
          icon={<BarChart3 size={16} />} color="linear-gradient(135deg,#27AE60,#1E8449)" />
      </div>

      {/* Debt metrics */}
      {stats && (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <Metric label="Tổng dư nợ" value={shortMoney(stats.totalOutstanding)}
              sub={`Gốc ${shortMoney(stats.outstandingPrincipal)}`}
              icon={<WalletCards size={16} />} color="linear-gradient(135deg,#991B1B,#C82020)" />
            <Metric label={`Đến hạn trong ${stats.dueWithinDays} ngày`} value={stats.dueSoonInstallments}
              sub={`${stats.dueSoonCustomers} khách hàng`}
              icon={<CalendarClock size={16} />} color="linear-gradient(135deg,#D97706,#F59E0B)" />
            <Metric label="Kỳ đang quá hạn" value={stats.overdueInstallments}
              sub={`${stats.overdueCustomers} khách hàng`}
              icon={<AlertTriangle size={16} />} color="linear-gradient(135deg,#B91C1C,#EF4444)" />
            <Metric label="Lãi + phí phạt còn lại" value={shortMoney(stats.outstandingInterest + stats.outstandingLateFee)}
              sub={`Phí phạt ${shortMoney(stats.outstandingLateFee)}`}
              icon={<CircleDollarSign size={16} />} color="linear-gradient(135deg,#6D28D9,#8B5CF6)" />
          </div>

          {/* Doanh thu phí — phí thẩm định đã thu từ các khoản đã giải ngân */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <Metric label="Doanh thu phí đã thu" value={shortMoney(stats.totalFeeRevenue ?? 0)}
              sub="Tổng phí + VAT (khoản đã giải ngân)"
              icon={<Receipt size={16} />} color="linear-gradient(135deg,#0F766E,#14B8A6)" />
            <Metric label="Phí thẩm định" value={shortMoney(stats.totalAppraisalFee ?? 0)}
              sub="Chưa gồm VAT"
              icon={<Receipt size={16} />} color="linear-gradient(135deg,#0E7490,#06B6D4)" />
            <Metric label="VAT đã thu (10%)" value={shortMoney(stats.totalVatCollected ?? 0)}
              sub="Thuế GTGT trên phí thẩm định"
              icon={<Receipt size={16} />} color="linear-gradient(135deg,#1D4ED8,#3B82F6)" />
            <Metric label="Đã giải ngân" value={shortMoney(stats.totalFundedVolume ?? 0)}
              sub={`${stats.fundedLoans ?? 0} khoản`}
              icon={<BarChart3 size={16} />} color="linear-gradient(135deg,#27AE60,#1E8449)" />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
            <DebtDonut stats={stats} />
            <RepaymentTable items={stats.repaymentAttentionItems || []} />
          </div>
        </>
      )}

      {/* Chart card */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-gray-400 dark:text-gray-500" />
            <h3 className="font-bold text-gray-800 dark:text-gray-100">Biểu đồ hoạt động</h3>
          </div>
          {/* Period tabs */}
          <div className="flex overflow-hidden rounded-xl border border-gray-200 text-sm dark:border-gray-600">
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => handlePeriod(p.key)}
                className={`px-4 py-1.5 font-medium transition-colors ${
                  period === p.key
                    ? 'text-white'
                    : 'bg-white text-gray-500 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                }`}
                style={period === p.key ? { background: '#C82020' } : undefined}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Charts */}
        {chartLoading ? (
          <div className="flex h-44 items-center justify-center text-gray-400 dark:text-gray-500">
            <RefreshCw size={16} className="mr-2 animate-spin" style={{ color: '#C82020' }} /> Đang tải...
          </div>
        ) : chart.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">Chưa có dữ liệu</p>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            <SingleMetricBarChart
              points={chart}
              period={period}
              isDark={isDark}
              metric="loanVolume"
              title="Giá trị khoản gọi vốn"
              subtitle="Tổng giá trị khoản phát sinh theo kỳ"
              gradient="linear-gradient(180deg,#E84A20,#C82020)"
              formatValue={formatMoney}
              formatTick={shortMoney}
            />
            <SingleMetricBarChart
              points={chart}
              period={period}
              isDark={isDark}
              metric="newUsers"
              title="Khách hàng mới"
              subtitle="Số tài khoản khách hàng tạo mới"
              gradient="linear-gradient(180deg,#60A5FA,#2563EB)"
              formatValue={value => `${Math.round(value)} khách hàng`}
              formatTick={value => (value > 0 ? Math.round(value).toString() : '')}
            />
          </div>
        )}
      </div>

      {/* Test push notification */}
      {canSendTestPush && <TestPushPanel />}
    </div>
  );
}
